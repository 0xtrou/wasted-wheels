// Street Racing 3D - Need for Speed Style
// Main Game Engine

class RacingGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.playerCar = null;
        this.aiCars = [];
        this.track = null;
        this.keys = {};
        this.speed = 0;
        this.maxSpeed = 100;
        this.acceleration = 0.5;
        this.deceleration = 0.3;
        this.turnSpeed = 0.03;
        this.nitro = 100;
        this.nitroActive = false;
        this.nitroBoostActive = false;
        this.nitroBoostEndTime = 0;
        this.nitroCooldownEndTime = 0;
        this.nitroBoostDuration = 10000; // 10 seconds
        this.nitroCooldown = 30000; // 30 seconds cooldown
        this.lap = 1;
        this.position = 1;
        this.gameStarted = false;
        this.trackPoints = [];

        // Helicopter and missile system
        this.helicopters = [];
        this.missiles = [];
        this.explosions = [];
        this.gameOver = false;
        this.raceFinished = false;
        this.lastDamageSource = null; // 'ghost' or 'helicopter'

        // Ghost system
        this.ghosts = [];
        this.ghostsCollected = 0;
        this.maxGhosts = 6;
        this.ghostRespawnTime = 5000; // 5 seconds

        // Nitro boost effects
        this.nitroTrails = [];

        // Pickup items system
        this.pickups = [];
        this.maxPickups = 15; // More pickups on track
        this.pickupEffects = [];

        // Car names for leaderboard
        this.carNames = [
            'PLAYER', 'VIPER', 'SHADOW', 'NITRO', 'BLAZE',
            'THUNDER', 'GHOST', 'PHOENIX', 'STORM', 'DEMON'
        ];

        // Viewport culling settings
        this.viewDistance = 500;
        this.viewDistanceSq = 500 * 500; // Squared for faster checks
        this.buildingViewDistSq = 800 * 800; // Buildings visible from far away
        this.frustum = new THREE.Frustum();
        this.cameraViewProjectionMatrix = new THREE.Matrix4();

        // Object pools for culling - categorized by type
        this.cullableObjects = [];
        this.buildings = [];
        this.roadSegments = [];
        this.staticObjects = [];

        // Sound system
        this.audioContext = null;
        this.sounds = {};
        this.engineOscillator = null;
        this.engineGain = null;

        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x1a1a2e, 100, 800);

        // Camera setup - third person view
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 8, 20);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = false;
        document.body.insertBefore(this.renderer.domElement, document.body.firstChild);
        this.renderer.domElement.id = 'gameCanvas';

        // Create environment
        this.createSkybox();
        this.createLighting();
        this.createTrack();
        this.createPlayerCar();
        this.createAICars();
        this.createEnvironment();
        this.createHelicopters();
        this.createGhosts();
        this.createPickups();

        // Event listeners
        this.setupControls();
        window.addEventListener('resize', () => this.onResize());

        // Initialize sound system
        this.initSoundSystem();

        // Initialize health display
        this.updateHealthDisplay();

        // Start game loop
        this.countdown();
    }

    initSoundSystem() {
        // Audio will be initialized when user clicks START button in countdown()
        // This is required by browser autoplay policies
    }

    playSound(type, volume = 0.3) {
        if (!this.audioContext) return;

        // Sound queue system - max 5 playing sounds
        // FIFO: first in, first out - but only remove sounds that played 100ms+
        if (!this.activeSounds) this.activeSounds = [];

        const currentTime = Date.now();
        const minPlayTime = 100; // 100ms minimum play time

        // Clean up sounds that have finished (played for 2+ seconds)
        this.activeSounds = this.activeSounds.filter(s => currentTime - s.startTime < 2000);

        // Check if we're at max capacity (5 sounds)
        if (this.activeSounds.length >= 5) {
            // Find the oldest sound that has played for at least 100ms
            const oldEnough = this.activeSounds.filter(s => currentTime - s.startTime >= minPlayTime);

            if (oldEnough.length > 0) {
                // Remove the oldest one that's played long enough
                const toRemove = oldEnough[0];
                const idx = this.activeSounds.indexOf(toRemove);
                if (idx > -1) {
                    this.activeSounds.splice(idx, 1);
                }
            } else {
                // All sounds are too new (< 100ms), skip this sound
                return;
            }
        }

        // Track this sound
        const soundEntry = { type, startTime: currentTime };
        this.activeSounds.push(soundEntry);

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        if (type === 'nitro') {
            // Whoosh/boost sound
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.frequency.exponentialRampToValueAtTime(500, now + 0.5);

            gain.gain.setValueAtTime(volume * 0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.5);

            // Add noise burst
            this.playNoise(0.1, 0.3, volume * 0.3);

        } else if (type === 'hit') {
            // MASSIVE CRASHY car collision sound
            const masterGain = ctx.createGain();
            masterGain.gain.value = volume * 1.5; // Louder!
            masterGain.connect(ctx.destination);

            // Heavy compressor for MAXIMUM punch
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -30;
            compressor.knee.value = 0;
            compressor.ratio.value = 20;
            compressor.attack.value = 0;
            compressor.release.value = 0.1;
            compressor.connect(masterGain);

            // 1. MASSIVE initial impact (double layered)
            for (let layer = 0; layer < 2; layer++) {
                const impactOsc = ctx.createOscillator();
                const impactGain = ctx.createGain();
                impactOsc.type = layer === 0 ? 'sine' : 'triangle';
                impactOsc.frequency.setValueAtTime(120 - layer * 40, now);
                impactOsc.frequency.exponentialRampToValueAtTime(25, now + 0.25);
                impactGain.gain.setValueAtTime(1.2, now);
                impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                impactOsc.connect(impactGain);
                impactGain.connect(compressor);
                impactOsc.start(now);
                impactOsc.stop(now + 0.25);
            }

            // 2. BRUTAL metal crunch (6 frequencies for chaos)
            const metalFreqs = [150, 200, 280, 380, 500, 650];
            metalFreqs.forEach((freq, i) => {
                const metalOsc = ctx.createOscillator();
                const metalGain = ctx.createGain();
                const metalFilter = ctx.createBiquadFilter();
                const metalDist = ctx.createWaveShaper();

                // Distortion curve for gritty metal sound
                const curve = new Float32Array(256);
                for (let j = 0; j < 256; j++) {
                    const x = (j / 128) - 1;
                    curve[j] = Math.tanh(x * 3);
                }
                metalDist.curve = curve;

                metalOsc.type = 'sawtooth';
                metalOsc.frequency.setValueAtTime(freq + Math.random() * 80, now);
                metalOsc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 0.3);

                metalFilter.type = 'bandpass';
                metalFilter.frequency.value = freq;
                metalFilter.Q.value = 5 + Math.random() * 3;

                metalGain.gain.setValueAtTime(0.6 - i * 0.08, now);
                metalGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2 + i * 0.04);

                metalOsc.connect(metalDist);
                metalDist.connect(metalFilter);
                metalFilter.connect(metalGain);
                metalGain.connect(compressor);
                metalOsc.start(now + i * 0.008);
                metalOsc.stop(now + 0.35 + i * 0.04);
            });

            // 3. Violent sheet metal screaming
            const screamFreqs = [700, 1000, 1400, 1900, 2500];
            screamFreqs.forEach((freq, i) => {
                const screamOsc = ctx.createOscillator();
                const screamGain = ctx.createGain();

                screamOsc.type = 'sawtooth';
                screamOsc.frequency.setValueAtTime(freq + Math.random() * 200, now);
                screamOsc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.5);

                screamGain.gain.setValueAtTime(0.25 - i * 0.04, now);
                screamGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4 + i * 0.06);

                screamOsc.connect(screamGain);
                screamGain.connect(compressor);
                screamOsc.start(now);
                screamOsc.stop(now + 0.5 + i * 0.06);
            });

            // 4. EXPLOSIVE glass shatter
            const glassLen = 0.4;
            const glassBuffer = ctx.createBuffer(1, ctx.sampleRate * glassLen, ctx.sampleRate);
            const glassData = glassBuffer.getChannelData(0);
            for (let i = 0; i < glassData.length; i++) {
                // Intense crackling with random spikes
                const spike = Math.random() > 0.95 ? 2 : 1;
                glassData[i] = (Math.random() * 2 - 1) * spike * Math.pow(1 - i / glassData.length, 0.3);
            }
            const glassSource = ctx.createBufferSource();
            glassSource.buffer = glassBuffer;
            const glassGain = ctx.createGain();
            const glassFilter = ctx.createBiquadFilter();
            glassFilter.type = 'highpass';
            glassFilter.frequency.value = 2500;
            glassGain.gain.setValueAtTime(0.8, now);
            glassGain.gain.exponentialRampToValueAtTime(0.01, now + glassLen);
            glassSource.connect(glassFilter);
            glassFilter.connect(glassGain);
            glassGain.connect(compressor);
            glassSource.start(now);
            glassSource.stop(now + glassLen);

            // 5. SCREAMING tire skid
            const screechOsc = ctx.createOscillator();
            const screechOsc2 = ctx.createOscillator();
            const screechGain = ctx.createGain();
            const screechFilter = ctx.createBiquadFilter();
            screechOsc.type = 'sawtooth';
            screechOsc2.type = 'square';
            screechOsc.frequency.setValueAtTime(800, now);
            screechOsc.frequency.linearRampToValueAtTime(300, now + 0.15);
            screechOsc.frequency.linearRampToValueAtTime(900, now + 0.25);
            screechOsc.frequency.linearRampToValueAtTime(200, now + 0.4);
            screechOsc2.frequency.setValueAtTime(750, now);
            screechOsc2.frequency.linearRampToValueAtTime(350, now + 0.4);
            screechFilter.type = 'bandpass';
            screechFilter.frequency.value = 600;
            screechFilter.Q.value = 12;
            screechGain.gain.setValueAtTime(0.4, now);
            screechGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            screechOsc.connect(screechFilter);
            screechOsc2.connect(screechFilter);
            screechFilter.connect(screechGain);
            screechGain.connect(compressor);
            screechOsc.start(now);
            screechOsc2.start(now);
            screechOsc.stop(now + 0.4);
            screechOsc2.stop(now + 0.4);

            // 6. CHAOTIC debris explosion
            const debrisLen = 0.5;
            const debrisBuffer = ctx.createBuffer(1, ctx.sampleRate * debrisLen, ctx.sampleRate);
            const debrisData = debrisBuffer.getChannelData(0);
            for (let i = 0; i < debrisData.length; i++) {
                const chaos = Math.random() > 0.9 ? 1.5 : 1;
                debrisData[i] = (Math.random() * 2 - 1) * chaos * Math.pow(1 - i / debrisData.length, 0.4);
            }
            const debrisSource = ctx.createBufferSource();
            debrisSource.buffer = debrisBuffer;
            const debrisGain = ctx.createGain();
            const debrisFilter = ctx.createBiquadFilter();
            debrisFilter.type = 'bandpass';
            debrisFilter.frequency.value = 1200;
            debrisFilter.Q.value = 0.8;
            debrisGain.gain.setValueAtTime(0.7, now + 0.02);
            debrisGain.gain.exponentialRampToValueAtTime(0.01, now + debrisLen);
            debrisSource.connect(debrisFilter);
            debrisFilter.connect(debrisGain);
            debrisGain.connect(compressor);
            debrisSource.start(now + 0.02);
            debrisSource.stop(now + debrisLen + 0.02);

            // 7. THUNDEROUS sub-bass (chest punch)
            const subOsc = ctx.createOscillator();
            const subOsc2 = ctx.createOscillator();
            const subGain = ctx.createGain();
            subOsc.type = 'sine';
            subOsc2.type = 'sine';
            subOsc.frequency.setValueAtTime(60, now);
            subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
            subOsc2.frequency.setValueAtTime(45, now);
            subOsc2.frequency.exponentialRampToValueAtTime(15, now + 0.35);
            subGain.gain.setValueAtTime(1, now);
            subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            subOsc.connect(subGain);
            subOsc2.connect(subGain);
            subGain.connect(compressor);
            subOsc.start(now);
            subOsc2.start(now);
            subOsc.stop(now + 0.35);
            subOsc2.stop(now + 0.35);

            // 8. Multiple plastic/bumper CRACKS
            for (let c = 0; c < 3; c++) {
                const crackOsc = ctx.createOscillator();
                const crackGain = ctx.createGain();
                crackOsc.type = 'square';
                crackOsc.frequency.setValueAtTime(3000 - c * 400, now + c * 0.03);
                crackOsc.frequency.exponentialRampToValueAtTime(600, now + c * 0.03 + 0.1);
                crackGain.gain.setValueAtTime(0.35, now + c * 0.03);
                crackGain.gain.exponentialRampToValueAtTime(0.01, now + c * 0.03 + 0.1);
                crackOsc.connect(crackGain);
                crackGain.connect(compressor);
                crackOsc.start(now + c * 0.03);
                crackOsc.stop(now + c * 0.03 + 0.12);
            }

            // 9. Secondary crunch wave
            const crunch2Osc = ctx.createOscillator();
            const crunch2Gain = ctx.createGain();
            crunch2Osc.type = 'sawtooth';
            crunch2Osc.frequency.setValueAtTime(250, now + 0.08);
            crunch2Osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
            crunch2Gain.gain.setValueAtTime(0.5, now + 0.08);
            crunch2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            crunch2Osc.connect(crunch2Gain);
            crunch2Gain.connect(compressor);
            crunch2Osc.start(now + 0.08);
            crunch2Osc.stop(now + 0.3);

        } else if (type === 'ghost') {
            // Spooky whoosh
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(400, now);
            osc1.frequency.exponentialRampToValueAtTime(200, now + 0.4);

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(600, now);
            osc2.frequency.exponentialRampToValueAtTime(150, now + 0.5);

            filter.type = 'bandpass';
            filter.frequency.value = 400;
            filter.Q.value = 2;

            gain.gain.setValueAtTime(volume * 0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.5);
            osc2.stop(now + 0.5);

        } else if (type === 'health') {
            // Pleasant chime
            const frequencies = [523, 659, 784]; // C5, E5, G5
            frequencies.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.value = freq;

                gain.gain.setValueAtTime(0, now + i * 0.08);
                gain.gain.linearRampToValueAtTime(volume * 0.3, now + i * 0.08 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.4);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.4);
            });

        } else if (type === 'shield') {
            // Power-up sound
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            osc.frequency.setValueAtTime(800, now + 0.2);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);

            filter.type = 'lowpass';
            filter.frequency.value = 2000;

            gain.gain.setValueAtTime(volume * 0.3, now);
            gain.gain.setValueAtTime(volume * 0.3, now + 0.35);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.5);

        } else if (type === 'lap') {
            // Lap complete fanfare
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.value = freq;

                gain.gain.setValueAtTime(0, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(volume * 0.25, now + i * 0.1 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.3);
            });

        } else if (type === 'explosion') {
            // DEVASTATING CINEMATIC missile explosion
            const masterGain = ctx.createGain();
            masterGain.gain.value = volume * 1.8; // LOUDER!
            masterGain.connect(ctx.destination);

            // BRUTAL compressor for maximum impact
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -40;
            compressor.knee.value = 0;
            compressor.ratio.value = 20;
            compressor.attack.value = 0;
            compressor.release.value = 0.05;
            compressor.connect(masterGain);

            // 1. NUCLEAR initial BOOM (triple layered)
            for (let layer = 0; layer < 3; layer++) {
                const boomOsc = ctx.createOscillator();
                const boomGain = ctx.createGain();
                boomOsc.type = layer === 0 ? 'sine' : (layer === 1 ? 'triangle' : 'sine');
                boomOsc.frequency.setValueAtTime(100 - layer * 25, now);
                boomOsc.frequency.exponentialRampToValueAtTime(15, now + 0.6 + layer * 0.1);
                boomGain.gain.setValueAtTime(1.5 - layer * 0.3, now);
                boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6 + layer * 0.1);
                boomOsc.connect(boomGain);
                boomGain.connect(compressor);
                boomOsc.start(now);
                boomOsc.stop(now + 0.7 + layer * 0.1);
            }

            // 2. EARTH-SHAKING sub-bass (feel it in your chest)
            const subFreqs = [30, 45, 60];
            subFreqs.forEach((freq, i) => {
                const subOsc = ctx.createOscillator();
                const subGain = ctx.createGain();
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(freq, now);
                subOsc.frequency.exponentialRampToValueAtTime(10 + i * 3, now + 1.0);
                subGain.gain.setValueAtTime(1.2 - i * 0.2, now);
                subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                subOsc.connect(subGain);
                subGain.connect(compressor);
                subOsc.start(now);
                subOsc.stop(now + 1.0);
            });

            // 3. MASSIVE explosion crackle with distortion
            const crackleFreqs = [150, 220, 300, 400];
            crackleFreqs.forEach((freq, i) => {
                const crackleOsc = ctx.createOscillator();
                const crackleGain = ctx.createGain();
                const crackleDist = ctx.createWaveShaper();
                const curve = new Float32Array(256);
                for (let j = 0; j < 256; j++) {
                    const x = (j / 128) - 1;
                    curve[j] = Math.tanh(x * 5);
                }
                crackleDist.curve = curve;

                crackleOsc.type = 'sawtooth';
                crackleOsc.frequency.setValueAtTime(freq + Math.random() * 50, now);
                crackleOsc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
                crackleGain.gain.setValueAtTime(0.8 - i * 0.15, now);
                crackleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4 + i * 0.05);
                crackleOsc.connect(crackleDist);
                crackleDist.connect(crackleGain);
                crackleGain.connect(compressor);
                crackleOsc.start(now);
                crackleOsc.stop(now + 0.5 + i * 0.05);
            });

            // 4. ROARING fire/sizzle
            const fireFreqs = [600, 900, 1300, 1800];
            fireFreqs.forEach((freq, i) => {
                const fireOsc = ctx.createOscillator();
                const fireGain = ctx.createGain();
                const fireFilter = ctx.createBiquadFilter();
                fireOsc.type = 'sawtooth';
                fireOsc.frequency.setValueAtTime(freq + Math.random() * 200, now);
                fireOsc.frequency.exponentialRampToValueAtTime(150, now + 0.6);
                fireFilter.type = 'bandpass';
                fireFilter.frequency.value = freq;
                fireFilter.Q.value = 2;
                fireGain.gain.setValueAtTime(0.4 - i * 0.08, now);
                fireGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5 + i * 0.05);
                fireOsc.connect(fireFilter);
                fireFilter.connect(fireGain);
                fireGain.connect(compressor);
                fireOsc.start(now);
                fireOsc.stop(now + 0.6 + i * 0.05);
            });

            // 5. VIOLENT debris/shrapnel explosion
            const noiseLen = 0.8;
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) {
                // Random intense spikes for shrapnel
                const spike = Math.random() > 0.92 ? 2.5 : 1;
                noiseData[i] = (Math.random() * 2 - 1) * spike * Math.pow(1 - i / noiseData.length, 0.25);
            }
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(6000, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(300, now + noiseLen);
            noiseGain.gain.setValueAtTime(1, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseLen);
            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(compressor);
            noiseSource.start(now);
            noiseSource.stop(now + noiseLen);

            // 6. Multiple SHOCKWAVE echoes
            for (let echo = 0; echo < 4; echo++) {
                const echoOsc = ctx.createOscillator();
                const echoGain = ctx.createGain();
                const delay = 0.1 + echo * 0.12;
                echoOsc.type = 'sine';
                echoOsc.frequency.setValueAtTime(70 - echo * 10, now + delay);
                echoOsc.frequency.exponentialRampToValueAtTime(20, now + delay + 0.3);
                echoGain.gain.setValueAtTime(0, now);
                echoGain.gain.setValueAtTime(0.6 - echo * 0.12, now + delay);
                echoGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.35);
                echoOsc.connect(echoGain);
                echoGain.connect(compressor);
                echoOsc.start(now);
                echoOsc.stop(now + delay + 0.4);
            }

            // 7. ROLLING THUNDER rumble tail
            const thunderLen = 1.5;
            const thunderBuffer = ctx.createBuffer(1, ctx.sampleRate * thunderLen, ctx.sampleRate);
            const thunderData = thunderBuffer.getChannelData(0);
            for (let i = 0; i < thunderData.length; i++) {
                const rumble = Math.sin(i / (ctx.sampleRate * 0.05)) * 0.5;
                thunderData[i] = (Math.random() * 2 - 1 + rumble) * Math.pow(1 - i / thunderData.length, 0.5) * 0.5;
            }
            const thunderSource = ctx.createBufferSource();
            thunderSource.buffer = thunderBuffer;
            const thunderGain = ctx.createGain();
            const thunderFilter = ctx.createBiquadFilter();
            thunderFilter.type = 'lowpass';
            thunderFilter.frequency.value = 200;
            thunderGain.gain.setValueAtTime(0, now);
            thunderGain.gain.linearRampToValueAtTime(0.6, now + 0.15);
            thunderGain.gain.exponentialRampToValueAtTime(0.01, now + thunderLen);
            thunderSource.connect(thunderFilter);
            thunderFilter.connect(thunderGain);
            thunderGain.connect(compressor);
            thunderSource.start(now + 0.1);
            thunderSource.stop(now + thunderLen + 0.1);

            // 8. HIGH PITCH whistle (flying debris)
            const whistleOsc = ctx.createOscillator();
            const whistleGain = ctx.createGain();
            whistleOsc.type = 'sine';
            whistleOsc.frequency.setValueAtTime(3000, now);
            whistleOsc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
            whistleGain.gain.setValueAtTime(0.15, now);
            whistleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            whistleOsc.connect(whistleGain);
            whistleGain.connect(compressor);
            whistleOsc.start(now);
            whistleOsc.stop(now + 0.5);

            // 9. SECONDARY EXPLOSION
            const boom2Osc = ctx.createOscillator();
            const boom2Gain = ctx.createGain();
            boom2Osc.type = 'sine';
            boom2Osc.frequency.setValueAtTime(80, now + 0.2);
            boom2Osc.frequency.exponentialRampToValueAtTime(25, now + 0.6);
            boom2Gain.gain.setValueAtTime(0, now);
            boom2Gain.gain.setValueAtTime(0.8, now + 0.2);
            boom2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            boom2Osc.connect(boom2Gain);
            boom2Gain.connect(compressor);
            boom2Osc.start(now);
            boom2Osc.stop(now + 0.7);

        } else if (type === 'countdown') {
            // Countdown beep (3, 2, 1)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = 440; // A4 note

            gain.gain.setValueAtTime(volume * 0.5, now);
            gain.gain.setValueAtTime(volume * 0.5, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.3);

        } else if (type === 'countdown_go') {
            // GO! sound - triumphant higher pitch
            const masterGain = ctx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(ctx.destination);

            // Main GO tone (higher pitch)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.value = 880; // A5 - higher than countdown
            gain1.gain.setValueAtTime(0.5, now);
            gain1.gain.setValueAtTime(0.5, now + 0.3);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            osc1.connect(gain1);
            gain1.connect(masterGain);
            osc1.start(now);
            osc1.stop(now + 0.6);

            // Harmony note (major third above)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.value = 1108.73; // C#6
            gain2.gain.setValueAtTime(0.3, now);
            gain2.gain.setValueAtTime(0.3, now + 0.3);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(masterGain);
            osc2.start(now);
            osc2.stop(now + 0.6);

            // Fifth note for full chord
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'sine';
            osc3.frequency.value = 1318.51; // E6
            gain3.gain.setValueAtTime(0.25, now);
            gain3.gain.setValueAtTime(0.25, now + 0.3);
            gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
            osc3.connect(gain3);
            gain3.connect(masterGain);
            osc3.start(now);
            osc3.stop(now + 0.6);

            // Rev burst sound effect
            const revOsc = ctx.createOscillator();
            const revGain = ctx.createGain();
            const revFilter = ctx.createBiquadFilter();
            revOsc.type = 'sawtooth';
            revOsc.frequency.setValueAtTime(100, now);
            revOsc.frequency.exponentialRampToValueAtTime(400, now + 0.3);
            revFilter.type = 'lowpass';
            revFilter.frequency.setValueAtTime(500, now);
            revFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
            revGain.gain.setValueAtTime(0.2, now);
            revGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            revOsc.connect(revFilter);
            revFilter.connect(revGain);
            revGain.connect(masterGain);
            revOsc.start(now);
            revOsc.stop(now + 0.4);
        }
    }

    startIdleEngine() {
        // Start the engine sound at idle during countdown
        if (!this.engineOscillators || !this.engineMasterGain || !this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Set idle RPM frequency (around 800 RPM)
        const idleFreq = (800 / 60) * 4; // ~53 Hz

        this.engineOscillators.forEach(({ osc, freqMult }) => {
            const targetFreq = Math.max(20, idleFreq * freqMult);
            osc.frequency.setValueAtTime(targetFreq, now);
        });

        // Set idle filter
        this.engineFilter.frequency.setValueAtTime(600, now);

        // Idle noise
        this.engineNoiseGain.gain.setValueAtTime(0.03, now);
        this.engineNoiseFilter.frequency.setValueAtTime(500, now);

        // Immediately set the idle engine sound (louder!)
        this.engineMasterGain.gain.setValueAtTime(0.18, now);

        console.log('Engine idle started!');
    }

    playNoise(duration, attack, volume) {
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + duration);
    }

    updateEngineSound() {
        if (!this.engineOscillators || !this.engineMasterGain || !this.audioContext) return;

        const speed = Math.abs(this.speed);
        const now = this.audioContext.currentTime;

        // RPM simulation (idle at 800 RPM, max at 8000 RPM)
        const minRPM = 800;
        const maxRPM = 8000;
        const rpm = minRPM + (speed / 200) * (maxRPM - minRPM);

        // Convert RPM to base frequency (V8 fires 4 times per revolution)
        // At 800 RPM: 800/60 * 4 = ~53 Hz, at 8000 RPM: 8000/60 * 4 = ~533 Hz
        const baseFreq = (rpm / 60) * 4;

        // Update all harmonic oscillators
        this.engineOscillators.forEach(({ osc, freqMult }) => {
            const targetFreq = Math.max(20, Math.min(baseFreq * freqMult, 2000));
            osc.frequency.setTargetAtTime(targetFreq, now, 0.05);
        });

        // Update filter cutoff based on RPM (higher RPM = brighter sound)
        const filterFreq = 400 + (rpm / maxRPM) * 1600;
        this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.1);

        // Update noise (more at higher RPM for exhaust/intake sound)
        const noiseGain = (speed / 200) * 0.08;
        this.engineNoiseGain.gain.setTargetAtTime(noiseGain, now, 0.1);
        this.engineNoiseFilter.frequency.setTargetAtTime(300 + (rpm / maxRPM) * 1500, now, 0.1);

        // Master volume based on game state
        const targetGain = this.gameStarted && !this.gameOver ? Math.min(0.08 + speed / 300, 0.25) : 0;
        this.engineMasterGain.gain.setTargetAtTime(targetGain, now, 0.15);
    }

    createSkybox() {
        // Night sky gradient
        const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0a1a) },
                bottomColor: { value: new THREE.Color(0x1a1a3e) },
                offset: { value: 400 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // Stars
        const starsGeo = new THREE.BufferGeometry();
        const starPositions = [];
        for (let i = 0; i < 2000; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 900;
            starPositions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
        }
        starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
        const stars = new THREE.Points(starsGeo, starsMat);
        this.scene.add(stars);
    }

    createLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404080, 0.4);
        this.scene.add(ambient);

        // Main directional light (moonlight)
        const moonLight = new THREE.DirectionalLight(0x8888ff, 0.5);
        moonLight.position.set(100, 100, 50);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 2048;
        moonLight.shadow.mapSize.height = 2048;
        moonLight.shadow.camera.near = 10;
        moonLight.shadow.camera.far = 500;
        moonLight.shadow.camera.left = -200;
        moonLight.shadow.camera.right = 200;
        moonLight.shadow.camera.top = 200;
        moonLight.shadow.camera.bottom = -200;
        this.scene.add(moonLight);

        // Hemisphere light for better ambient
        const hemiLight = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.3);
        this.scene.add(hemiLight);
    }

    createNFSCar(color, isPlayer = false) {
        const car = new THREE.Group();

        // Car materials
        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 1
        });

        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x111122,
            metalness: 0,
            roughness: 0,
            transmission: 0.9,
            transparent: true,
            opacity: 0.3
        });

        const chromeMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 1,
            roughness: 0.1
        });

        const blackMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.5,
            roughness: 0.5
        });

        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });

        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffee,
            emissive: 0xffffee,
            emissiveIntensity: 1
        });

        // Main body - sleek sports car shape (like Nissan GTR / Porsche style)
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(-2.2, 0);
        bodyShape.lineTo(-2.2, 0.4);
        bodyShape.quadraticCurveTo(-2.1, 0.8, -1.8, 0.9);
        bodyShape.lineTo(-0.5, 1.1);
        bodyShape.quadraticCurveTo(0, 1.15, 0.5, 1.1);
        bodyShape.lineTo(1.8, 0.9);
        bodyShape.quadraticCurveTo(2.1, 0.8, 2.2, 0.4);
        bodyShape.lineTo(2.2, 0);

        const bodyExtrudeSettings = {
            depth: 1.8,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 5
        };

        // Lower body
        const lowerBody = new THREE.Mesh(
            new THREE.BoxGeometry(4.5, 0.6, 2),
            bodyMaterial
        );
        lowerBody.position.y = 0.5;
        lowerBody.castShadow = true;
        car.add(lowerBody);

        // Main cabin
        const cabinGeo = new THREE.BoxGeometry(2.5, 0.7, 1.7);
        const cabin = new THREE.Mesh(cabinGeo, bodyMaterial);
        cabin.position.set(-0.2, 1.1, 0);
        cabin.castShadow = true;
        car.add(cabin);

        // Hood (front)
        const hoodGeo = new THREE.BoxGeometry(1.8, 0.35, 1.9);
        const hood = new THREE.Mesh(hoodGeo, bodyMaterial);
        hood.position.set(1.4, 0.85, 0);
        hood.rotation.z = -0.05;
        hood.castShadow = true;
        car.add(hood);

        // Hood scoop
        const scoopGeo = new THREE.BoxGeometry(0.6, 0.15, 0.5);
        const scoop = new THREE.Mesh(scoopGeo, blackMaterial);
        scoop.position.set(1.2, 1.1, 0);
        car.add(scoop);

        // Trunk (rear)
        const trunkGeo = new THREE.BoxGeometry(1.2, 0.3, 1.9);
        const trunk = new THREE.Mesh(trunkGeo, bodyMaterial);
        trunk.position.set(-1.6, 0.85, 0);
        trunk.rotation.z = 0.08;
        trunk.castShadow = true;
        car.add(trunk);

        // Rear spoiler
        const spoilerWingGeo = new THREE.BoxGeometry(0.1, 0.4, 2);
        const spoilerWing = new THREE.Mesh(spoilerWingGeo, bodyMaterial);
        spoilerWing.position.set(-2.25, 1.4, 0);
        car.add(spoilerWing);

        const spoilerStandGeo = new THREE.BoxGeometry(0.08, 0.3, 0.1);
        const spoilerStandL = new THREE.Mesh(spoilerStandGeo, blackMaterial);
        spoilerStandL.position.set(-2.15, 1.15, 0.7);
        car.add(spoilerStandL);
        const spoilerStandR = new THREE.Mesh(spoilerStandGeo, blackMaterial);
        spoilerStandR.position.set(-2.15, 1.15, -0.7);
        car.add(spoilerStandR);

        // Windshield
        const windshieldGeo = new THREE.BoxGeometry(0.1, 0.6, 1.5);
        const windshield = new THREE.Mesh(windshieldGeo, glassMaterial);
        windshield.position.set(0.9, 1.3, 0);
        windshield.rotation.z = 0.5;
        car.add(windshield);

        // Rear window
        const rearWindowGeo = new THREE.BoxGeometry(0.1, 0.5, 1.5);
        const rearWindow = new THREE.Mesh(rearWindowGeo, glassMaterial);
        rearWindow.position.set(-1.25, 1.25, 0);
        rearWindow.rotation.z = -0.4;
        car.add(rearWindow);

        // Side windows
        const sideWindowGeo = new THREE.BoxGeometry(1.8, 0.45, 0.05);
        const sideWindowL = new THREE.Mesh(sideWindowGeo, glassMaterial);
        sideWindowL.position.set(-0.1, 1.3, 0.9);
        car.add(sideWindowL);
        const sideWindowR = new THREE.Mesh(sideWindowGeo, glassMaterial);
        sideWindowR.position.set(-0.1, 1.3, -0.9);
        car.add(sideWindowR);

        // Front bumper
        const frontBumperGeo = new THREE.BoxGeometry(0.3, 0.35, 2);
        const frontBumper = new THREE.Mesh(frontBumperGeo, blackMaterial);
        frontBumper.position.set(2.3, 0.4, 0);
        car.add(frontBumper);

        // Front grille
        const grilleGeo = new THREE.BoxGeometry(0.05, 0.2, 1.2);
        const grille = new THREE.Mesh(grilleGeo, chromeMaterial);
        grille.position.set(2.42, 0.5, 0);
        car.add(grille);

        // Headlights
        const headlightGeo = new THREE.BoxGeometry(0.1, 0.15, 0.4);
        const headlightL = new THREE.Mesh(headlightGeo, headlightMaterial);
        headlightL.position.set(2.35, 0.7, 0.65);
        car.add(headlightL);
        const headlightR = new THREE.Mesh(headlightGeo, headlightMaterial);
        headlightR.position.set(2.35, 0.7, -0.65);
        car.add(headlightR);

        // Headlight beams (for player car)
        if (isPlayer) {
            const beamGeo = new THREE.ConeGeometry(3, 15, 8, 1, true);
            const beamMat = new THREE.MeshBasicMaterial({
                color: 0xffffcc,
                transparent: true,
                opacity: 0.1,
                side: THREE.DoubleSide
            });
            const beamL = new THREE.Mesh(beamGeo, beamMat);
            beamL.position.set(10, 0.5, 0.65);
            beamL.rotation.z = Math.PI / 2;
            car.add(beamL);
            const beamR = new THREE.Mesh(beamGeo, beamMat);
            beamR.position.set(10, 0.5, -0.65);
            beamR.rotation.z = Math.PI / 2;
            car.add(beamR);

            // Actual lights
            const headlightSpotL = new THREE.SpotLight(0xffffee, 2, 50, Math.PI / 6, 0.5);
            headlightSpotL.position.set(2.5, 0.7, 0.65);
            headlightSpotL.target.position.set(20, 0, 0.65);
            car.add(headlightSpotL);
            car.add(headlightSpotL.target);

            const headlightSpotR = new THREE.SpotLight(0xffffee, 2, 50, Math.PI / 6, 0.5);
            headlightSpotR.position.set(2.5, 0.7, -0.65);
            headlightSpotR.target.position.set(20, 0, -0.65);
            car.add(headlightSpotR);
            car.add(headlightSpotR.target);
        }

        // Taillights
        const taillightGeo = new THREE.BoxGeometry(0.1, 0.12, 0.35);
        const taillightL = new THREE.Mesh(taillightGeo, lightMaterial);
        taillightL.position.set(-2.3, 0.7, 0.65);
        car.add(taillightL);
        const taillightR = new THREE.Mesh(taillightGeo, lightMaterial);
        taillightR.position.set(-2.3, 0.7, -0.65);
        car.add(taillightR);

        // Rear bumper
        const rearBumperGeo = new THREE.BoxGeometry(0.25, 0.3, 2);
        const rearBumper = new THREE.Mesh(rearBumperGeo, blackMaterial);
        rearBumper.position.set(-2.35, 0.35, 0);
        car.add(rearBumper);

        // Exhaust pipes
        const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8);
        const exhaust1 = new THREE.Mesh(exhaustGeo, chromeMaterial);
        exhaust1.position.set(-2.4, 0.25, 0.5);
        exhaust1.rotation.z = Math.PI / 2;
        car.add(exhaust1);
        const exhaust2 = new THREE.Mesh(exhaustGeo, chromeMaterial);
        exhaust2.position.set(-2.4, 0.25, 0.3);
        exhaust2.rotation.z = Math.PI / 2;
        car.add(exhaust2);
        const exhaust3 = new THREE.Mesh(exhaustGeo, chromeMaterial);
        exhaust3.position.set(-2.4, 0.25, -0.5);
        exhaust3.rotation.z = Math.PI / 2;
        car.add(exhaust3);
        const exhaust4 = new THREE.Mesh(exhaustGeo, chromeMaterial);
        exhaust4.position.set(-2.4, 0.25, -0.3);
        exhaust4.rotation.z = Math.PI / 2;
        car.add(exhaust4);

        // Side skirts
        const skirtGeo = new THREE.BoxGeometry(3.5, 0.15, 0.1);
        const skirtL = new THREE.Mesh(skirtGeo, blackMaterial);
        skirtL.position.set(0, 0.25, 1);
        car.add(skirtL);
        const skirtR = new THREE.Mesh(skirtGeo, blackMaterial);
        skirtR.position.set(0, 0.25, -1);
        car.add(skirtR);

        // Side mirrors
        const mirrorGeo = new THREE.BoxGeometry(0.15, 0.1, 0.2);
        const mirrorL = new THREE.Mesh(mirrorGeo, bodyMaterial);
        mirrorL.position.set(0.6, 1.1, 1.05);
        car.add(mirrorL);
        const mirrorR = new THREE.Mesh(mirrorGeo, bodyMaterial);
        mirrorR.position.set(0.6, 1.1, -1.05);
        car.add(mirrorR);

        // Wheels
        const wheelGroup = this.createWheel();

        const wheelFL = wheelGroup.clone();
        wheelFL.position.set(1.4, 0.35, 1.05);
        car.add(wheelFL);

        const wheelFR = wheelGroup.clone();
        wheelFR.position.set(1.4, 0.35, -1.05);
        wheelFR.rotation.y = Math.PI;
        car.add(wheelFR);

        const wheelRL = wheelGroup.clone();
        wheelRL.position.set(-1.3, 0.35, 1.05);
        car.add(wheelRL);

        const wheelRR = wheelGroup.clone();
        wheelRR.position.set(-1.3, 0.35, -1.05);
        wheelRR.rotation.y = Math.PI;
        car.add(wheelRR);

        car.wheels = [wheelFL, wheelFR, wheelRL, wheelRR];

        // Under glow for NFS style (player only)
        if (isPlayer) {
            const underglowL = new THREE.PointLight(0x00ffff, 2, 5);
            underglowL.position.set(0, 0.1, 1);
            car.add(underglowL);
            const underglowR = new THREE.PointLight(0x00ffff, 2, 5);
            underglowR.position.set(0, 0.1, -1);
            car.add(underglowR);
            const underglowF = new THREE.PointLight(0x00ffff, 2, 5);
            underglowF.position.set(1.5, 0.1, 0);
            car.add(underglowF);
            const underglowB = new THREE.PointLight(0x00ffff, 2, 5);
            underglowB.position.set(-1.5, 0.1, 0);
            car.add(underglowB);
        }

        car.castShadow = true;

        // Rotate entire car so front faces +Z direction (forward)
        car.rotation.y = -Math.PI / 2;

        // Wrap in container so rotation.y controls direction properly
        const carContainer = new THREE.Group();
        carContainer.add(car);
        carContainer.wheels = car.wheels;

        return carContainer;
    }

    createWheel() {
        const wheel = new THREE.Group();

        // Tire
        const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 32);
        const tireMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.1
        });
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.x = Math.PI / 2;
        wheel.add(tire);

        // Rim
        const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.26, 32);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.2
        });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        wheel.add(rim);

        // Rim spokes (5-spoke design)
        for (let i = 0; i < 5; i++) {
            const spokeGeo = new THREE.BoxGeometry(0.04, 0.2, 0.14);
            const spoke = new THREE.Mesh(spokeGeo, rimMat);
            spoke.position.x = Math.cos(i * Math.PI * 2 / 5) * 0.12;
            spoke.position.z = Math.sin(i * Math.PI * 2 / 5) * 0.12;
            spoke.position.y = 0.14;
            spoke.rotation.y = -i * Math.PI * 2 / 5;
            wheel.add(spoke);
        }

        // Center cap
        const capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16);
        const cap = new THREE.Mesh(capGeo, rimMat);
        cap.rotation.x = Math.PI / 2;
        cap.position.y = 0.14;
        wheel.add(cap);

        // Brake disc (visible through spokes)
        const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32);
        const discMat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            metalness: 0.8,
            roughness: 0.3
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = Math.PI / 2;
        wheel.add(disc);

        // Brake caliper
        const caliperGeo = new THREE.BoxGeometry(0.08, 0.12, 0.05);
        const caliperMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            metalness: 0.3,
            roughness: 0.5
        });
        const caliper = new THREE.Mesh(caliperGeo, caliperMat);
        caliper.position.set(0.15, 0, 0);
        wheel.add(caliper);

        return wheel;
    }

    createPlayerCar() {
        this.playerCar = this.createNFSCar(0x00aaff, true); // Blue player car

        // Position on track start line, facing the right direction
        const startPoint = this.trackPoints[0];
        const nextPoint = this.trackPoints[1];
        const startAngle = Math.atan2(
            nextPoint.x - startPoint.x,
            nextPoint.z - startPoint.z
        );

        this.playerCar.position.set(startPoint.x, startPoint.y + 0.8, startPoint.z);
        this.playerCar.rotation.y = startAngle;
        this.scene.add(this.playerCar);

        // Car state
        this.playerCar.velocity = 0;
        this.playerCar.angularVelocity = 0;
        this.playerCar.trackProgress = 0;
        this.playerCar.lap = 1;

        // Health system
        this.playerCar.maxHealth = 100;
        this.playerCar.health = 100;
        this.playerCar.destroyed = false;
        this.playerCar.isPlayer = true;
        this.playerCar.name = this.carNames[0]; // PLAYER
    }

    createAICars() {
        const colors = [
            0xff4400, // Orange
            0xffff00, // Yellow
            0xff0066, // Pink
            0x00ff00, // Green
            0x9900ff, // Purple
            0xff0000, // Red
            0xffffff  // White
        ];

        // Get track direction at start
        const startPoint = this.trackPoints[0];
        const nextPoint = this.trackPoints[1];
        const prevPoint = this.trackPoints[this.trackPoints.length - 1];
        const trackDir = new THREE.Vector3().subVectors(nextPoint, prevPoint).normalize();
        const perpDir = new THREE.Vector3(-trackDir.z, 0, trackDir.x); // Perpendicular for side offset
        const startAngle = Math.atan2(trackDir.x, trackDir.z);

        // Grid positions behind the player (rows of 2)
        const gridOffsets = [
            { row: 1, side: 1 },   // Row 1, right
            { row: 1, side: -1 },  // Row 1, left
            { row: 2, side: 1 },   // Row 2, right
            { row: 2, side: -1 },  // Row 2, left
            { row: 3, side: 1 },   // Row 3, right
            { row: 3, side: -1 },  // Row 3, left
            { row: 4, side: 0 }    // Row 4, center
        ];

        for (let i = 0; i < 7; i++) {
            const aiCar = this.createNFSCar(colors[i], false);

            // Position behind player in grid formation
            const rowOffset = gridOffsets[i].row * 8; // 8 units between rows
            const sideOffset = gridOffsets[i].side * 4; // 4 units side offset

            const pos = startPoint.clone()
                .sub(trackDir.clone().multiplyScalar(rowOffset))
                .add(perpDir.clone().multiplyScalar(sideOffset));

            aiCar.position.copy(pos);
            aiCar.position.y = pos.y + 0.8;
            aiCar.rotation.y = startAngle;

            aiCar.velocity = 0;
            aiCar.maxVelocity = 80 + Math.random() * 20; // Varied speeds (80-100 km/h)
            aiCar.trackProgress = 0;
            aiCar.targetPoint = 0;
            aiCar.skillLevel = 0.7 + Math.random() * 0.3;
            aiCar.lap = 1;

            // AI Nitro boost system
            aiCar.nitroBoostActive = false;
            aiCar.nitroBoostEndTime = 0;
            aiCar.nitroCooldownEndTime = Date.now() + Math.random() * 10000; // Stagger initial cooldowns
            aiCar.nitroBoostDuration = 10000;
            aiCar.nitroCooldown = 30000;

            // Health system
            aiCar.maxHealth = 100;
            aiCar.health = 100;
            aiCar.destroyed = false;
            aiCar.isPlayer = false;
            aiCar.name = this.carNames[i + 1]; // Assign name from list

            this.aiCars.push(aiCar);
            this.scene.add(aiCar);
        }
    }

    createTrack() {
        // F1 oval track - simple and clean
        this.trackPoints = [];
        const roadWidth = 40;
        const roadY = 0.5;

        // Oval parameters
        const straightLength = 600;
        const curveRadius = 80;
        const numPoints = 200;

        // Generate oval centerline
        for (let i = 0; i < numPoints; i++) {
            const t = i / numPoints;
            const angle = t * Math.PI * 2;

            // Oval parametric: stretched circle
            const x = Math.sin(angle) * curveRadius;
            const z = Math.cos(angle) * (straightLength / 2 + curveRadius);

            // Make it more oval-shaped (flatten the sides)
            const ovalX = Math.sin(angle) * curveRadius;
            const ovalZ = Math.cos(angle) * straightLength / 2 + Math.sign(Math.cos(angle)) * curveRadius * Math.abs(Math.cos(angle));

            this.trackPoints.push(new THREE.Vector3(
                Math.sin(angle) * curveRadius,
                roadY,
                Math.cos(angle) * (straightLength / 2)
            ));
        }

        // Actually, let's do a proper stadium oval
        this.trackPoints = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / numPoints;
            let x, z;

            if (t < 0.25) {
                // Top straight (going right, +X)
                const p = t / 0.25;
                x = -curveRadius + p * 2 * curveRadius;
                z = straightLength / 2;
            } else if (t < 0.5) {
                // Right curve (going down)
                const p = (t - 0.25) / 0.25;
                const angle = Math.PI / 2 - p * Math.PI;
                x = curveRadius + Math.cos(angle) * curveRadius;
                z = Math.sin(angle) * straightLength / 2;
            } else if (t < 0.75) {
                // Bottom straight (going left, -X)
                const p = (t - 0.5) / 0.25;
                x = curveRadius - p * 2 * curveRadius;
                z = -straightLength / 2;
            } else {
                // Left curve (going up)
                const p = (t - 0.75) / 0.25;
                const angle = -Math.PI / 2 - p * Math.PI;
                x = -curveRadius + Math.cos(angle) * curveRadius;
                z = Math.sin(angle) * straightLength / 2;
            }

            this.trackPoints.push(new THREE.Vector3(x, roadY, z));
        }

        this.straightSectionEnd = Math.floor(numPoints * 0.25); // First straight section

        // Ground
        this.createHillTerrain();

        // Build road surface as ribbon
        const roadVerts = [];
        const roadIdx = [];

        for (let i = 0; i < this.trackPoints.length; i++) {
            const curr = this.trackPoints[i];
            const next = this.trackPoints[(i + 1) % this.trackPoints.length];

            // Direction and perpendicular
            const dx = next.x - curr.x;
            const dz = next.z - curr.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            const perpX = -dz / len;
            const perpZ = dx / len;

            // Left and right edge vertices
            roadVerts.push(
                curr.x + perpX * roadWidth / 2, roadY, curr.z + perpZ * roadWidth / 2,
                curr.x - perpX * roadWidth / 2, roadY, curr.z - perpZ * roadWidth / 2
            );

            // Triangle indices
            const idx = i * 2;
            const nextIdx = ((i + 1) % this.trackPoints.length) * 2;
            roadIdx.push(idx, nextIdx, idx + 1, idx + 1, nextIdx, nextIdx + 1);
        }

        const roadGeo = new THREE.BufferGeometry();
        roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
        roadGeo.setIndex(roadIdx);
        roadGeo.computeVertexNormals();

        const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({
            color: 0x333333, roughness: 0.9, side: THREE.DoubleSide
        }));
        this.scene.add(road);
        this.roadSegments.push(road);

        // White edge lines (as ribbons)
        this.createRibbonLine(roadWidth / 2 - 0.5, 0.5, 0xffffff);
        this.createRibbonLine(-roadWidth / 2 + 0.5, 0.5, 0xffffff);

        // Barriers (as ribbons/walls)
        this.createWallBarrier(roadWidth / 2 + 2, 1.2);
        this.createWallBarrier(-roadWidth / 2 - 2, 1.2);

        // Start/finish checkered line
        this.createStartLine();
    }

    createRibbonLine(offset, width, color) {
        const verts = [];
        const idx = [];

        for (let i = 0; i < this.trackPoints.length; i++) {
            const curr = this.trackPoints[i];
            const next = this.trackPoints[(i + 1) % this.trackPoints.length];

            const dx = next.x - curr.x;
            const dz = next.z - curr.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            const perpX = -dz / len;
            const perpZ = dx / len;

            // Position at offset from centerline
            const cx = curr.x + perpX * offset;
            const cz = curr.z + perpZ * offset;

            // Line width perpendicular
            verts.push(
                cx + perpX * width / 2, 0.52, cz + perpZ * width / 2,
                cx - perpX * width / 2, 0.52, cz - perpZ * width / 2
            );

            const vi = i * 2;
            const ni = ((i + 1) % this.trackPoints.length) * 2;
            idx.push(vi, ni, vi + 1, vi + 1, ni, ni + 1);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(idx);

        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        this.scene.add(mesh);
    }

    createWallBarrier(offset, height) {
        const verts = [];
        const idx = [];
        const colors = [];

        for (let i = 0; i < this.trackPoints.length; i++) {
            const curr = this.trackPoints[i];
            const next = this.trackPoints[(i + 1) % this.trackPoints.length];

            const dx = next.x - curr.x;
            const dz = next.z - curr.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            const perpX = -dz / len;
            const perpZ = dx / len;

            const x = curr.x + perpX * offset;
            const z = curr.z + perpZ * offset;

            // Bottom and top vertices
            verts.push(x, 0.5, z, x, 0.5 + height, z);

            // Alternating red/white colors
            const isRed = Math.floor(i / 10) % 2 === 0;
            const r = isRed ? 0.8 : 0.9;
            const g = isRed ? 0.1 : 0.9;
            const b = isRed ? 0.1 : 0.9;
            colors.push(r, g, b, r, g, b);

            // Quad indices (two triangles per segment)
            const vi = i * 2;
            const ni = ((i + 1) % this.trackPoints.length) * 2;
            idx.push(vi, ni, vi + 1, vi + 1, ni, ni + 1);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        }));
        this.scene.add(mesh);
        this.roadSegments.push(mesh);
    }

    createStartLine() {
        const p = this.trackPoints[0];
        const n = this.trackPoints[1];
        const dx = n.x - p.x;
        const dz = n.z - p.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        const perpX = -dz / len;
        const perpZ = dx / len;

        // Checkered pattern
        const checkSize = 2;
        const numChecks = 12;

        for (let i = 0; i < numChecks; i++) {
            for (let j = 0; j < 3; j++) {
                const isBlack = (i + j) % 2 === 0;
                const geo = new THREE.PlaneGeometry(checkSize, checkSize);
                const mat = new THREE.MeshBasicMaterial({
                    color: isBlack ? 0x000000 : 0xffffff,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geo, mat);

                // Position along perpendicular (across track)
                const offsetAlong = (i - numChecks / 2 + 0.5) * checkSize;
                const offsetPerp = (j - 1) * checkSize;

                mesh.position.set(
                    p.x + perpX * offsetAlong + dx / len * offsetPerp,
                    0.52,
                    p.z + perpZ * offsetAlong + dz / len * offsetPerp
                );
                mesh.rotation.x = -Math.PI / 2;

                this.scene.add(mesh);
            }
        }
    }

    createWaterTerrain() {
        // Create animated water plane
        const waterGeo = new THREE.PlaneGeometry(2000, 2000, 50, 50);
        const waterMat = new THREE.MeshBasicMaterial({
            color: 0x001133,
            transparent: true,
            opacity: 0.85
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -2;
        this.scene.add(water);
        this.water = water;

        // Add water shimmer effect
        const shimmerGeo = new THREE.PlaneGeometry(2000, 2000);
        const shimmerMat = new THREE.MeshBasicMaterial({
            color: 0x003366,
            transparent: true,
            opacity: 0.3
        });
        const shimmer = new THREE.Mesh(shimmerGeo, shimmerMat);
        shimmer.rotation.x = -Math.PI / 2;
        shimmer.position.y = -1.5;
        this.scene.add(shimmer);
    }

    createHillTerrain() {
        // Simple flat dark terrain below the road
        const terrainSize = 1000;
        const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);

        // Dark ground material
        const terrainMat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            side: THREE.DoubleSide
        });

        const terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.y = -1; // Below the road
        this.scene.add(terrain);
    }

    createEnvironment() {
        // City buildings - beautiful night skyline
        const buildingTypes = [
            { minH: 80, maxH: 180, w: 20, style: 'skyscraper' },
            { minH: 40, maxH: 80, w: 25, style: 'office' },
            { minH: 30, maxH: 60, w: 30, style: 'apartment' },
            { minH: 100, maxH: 200, w: 15, style: 'tower' }
        ];

        for (let i = 0; i < 60; i++) {
            const buildingGroup = new THREE.Group();

            const angle = Math.random() * Math.PI * 2;
            const distance = 500 + Math.random() * 400;
            const type = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
            const height = type.minH + Math.random() * (type.maxH - type.minH);
            const width = type.w * (0.8 + Math.random() * 0.4);
            const depth = width * (0.6 + Math.random() * 0.6);

            // Building base color - varied dark blues and grays
            const hue = 0.58 + Math.random() * 0.08; // Blue-ish
            const sat = 0.1 + Math.random() * 0.15;
            const light = 0.06 + Math.random() * 0.08;

            const buildingGeo = new THREE.BoxGeometry(width, height, depth);
            const buildingMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, sat, light)
            });
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.position.y = height / 2;
            buildingGroup.add(building);

            // Add decorative top for skyscrapers
            if (type.style === 'skyscraper' || type.style === 'tower') {
                const topGeo = new THREE.BoxGeometry(width * 0.6, height * 0.1, depth * 0.6);
                const topMat = new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(hue, sat, light + 0.05)
                });
                const top = new THREE.Mesh(topGeo, topMat);
                top.position.y = height * 1.05;
                buildingGroup.add(top);

                // Spire for tall towers
                if (height > 120 && Math.random() > 0.5) {
                    const spireGeo = new THREE.ConeGeometry(2, 20, 4);
                    const spireMat = new THREE.MeshBasicMaterial({ color: 0x333344 });
                    const spire = new THREE.Mesh(spireGeo, spireMat);
                    spire.position.y = height * 1.1 + 10;
                    buildingGroup.add(spire);
                }
            }

            // Windows - glowing night effect
            const windowRows = Math.floor(height / 6);
            const windowCols = Math.floor(width / 3.5);
            const windowColors = [
                new THREE.Color(0xffffcc), // Warm white
                new THREE.Color(0xffeedd), // Warm
                new THREE.Color(0xccddff), // Cool white
                new THREE.Color(0xffcc88), // Orange
                new THREE.Color(0x88ccff)  // Blue
            ];

            for (let row = 1; row < Math.min(windowRows, 20); row++) {
                for (let col = 0; col < Math.min(windowCols, 8); col++) {
                    if (Math.random() > 0.25) { // 75% of windows lit
                        const windowGeo = new THREE.PlaneGeometry(1.2, 1.8);
                        const windowColor = windowColors[Math.floor(Math.random() * windowColors.length)];
                        const intensity = 0.5 + Math.random() * 0.5;
                        const windowMat = new THREE.MeshBasicMaterial({
                            color: windowColor.clone().multiplyScalar(intensity)
                        });

                        // All 4 sides
                        const xPos = -width/2 + 2 + col * 3.5;
                        const yPos = 3 + row * 6;

                        // Front
                        const wFront = new THREE.Mesh(windowGeo, windowMat);
                        wFront.position.set(xPos, yPos, depth/2 + 0.1);
                        buildingGroup.add(wFront);

                        // Back
                        const wBack = new THREE.Mesh(windowGeo, windowMat);
                        wBack.position.set(xPos, yPos, -depth/2 - 0.1);
                        wBack.rotation.y = Math.PI;
                        buildingGroup.add(wBack);

                        // Left side (fewer windows)
                        if (col < windowCols / 2 && Math.random() > 0.4) {
                            const wLeft = new THREE.Mesh(windowGeo, windowMat);
                            wLeft.position.set(-width/2 - 0.1, yPos, -depth/2 + 2 + col * 3.5);
                            wLeft.rotation.y = -Math.PI / 2;
                            buildingGroup.add(wLeft);
                        }

                        // Right side
                        if (col < windowCols / 2 && Math.random() > 0.4) {
                            const wRight = new THREE.Mesh(windowGeo, windowMat);
                            wRight.position.set(width/2 + 0.1, yPos, -depth/2 + 2 + col * 3.5);
                            wRight.rotation.y = Math.PI / 2;
                            buildingGroup.add(wRight);
                        }
                    }
                }
            }

            // Rooftop features
            if (Math.random() > 0.4) {
                // Antenna with blinking light
                const antennaGeo = new THREE.CylinderGeometry(0.15, 0.25, 12, 4);
                const antennaMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
                const antenna = new THREE.Mesh(antennaGeo, antennaMat);
                antenna.position.y = height + 6;
                buildingGroup.add(antenna);

                // Red warning light
                const lightGeo = new THREE.SphereGeometry(0.5, 6, 6);
                const lightMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
                const light = new THREE.Mesh(lightGeo, lightMat);
                light.position.y = height + 12;
                buildingGroup.add(light);
            }

            // Rooftop glow for some buildings
            if (Math.random() > 0.7) {
                const glowGeo = new THREE.PlaneGeometry(width * 0.8, depth * 0.8);
                const glowMat = new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0x4488ff : 0xff4488,
                    transparent: true,
                    opacity: 0.3
                });
                const glow = new THREE.Mesh(glowGeo, glowMat);
                glow.rotation.x = -Math.PI / 2;
                glow.position.y = height + 0.5;
                buildingGroup.add(glow);
            }

            buildingGroup.position.set(
                Math.cos(angle) * distance,
                0,
                Math.sin(angle) * distance
            );

            this.scene.add(buildingGroup);
            this.buildings.push(buildingGroup);
        }

        // Street lights along the track - grouped and fewer lights
        for (let i = 0; i < this.trackPoints.length; i += 10) {
            const lightGroup = new THREE.Group();

            const point = this.trackPoints[i];
            const next = this.trackPoints[(i + 1) % this.trackPoints.length];
            const dir = new THREE.Vector3().subVectors(next, point).normalize();
            const perp = new THREE.Vector3(-dir.z, 0, dir.x);

            // Light pole
            const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 8, 6);
            const poleMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 4;
            lightGroup.add(pole);

            // Light fixture
            const fixtureGeo = new THREE.SphereGeometry(0.4, 6, 6);
            const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
            const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
            fixture.position.set(-perp.x * 3, 7.5, -perp.z * 3);
            lightGroup.add(fixture);

            // Actual light - only one per pole
            const streetLight = new THREE.PointLight(0xffeecc, 0.8, 25);
            streetLight.position.copy(fixture.position);
            lightGroup.add(streetLight);

            const polePos = point.clone().add(perp.clone().multiplyScalar(12));
            lightGroup.position.copy(polePos);

            this.scene.add(lightGroup);
            this.registerCullable(lightGroup);
        }
    }

    createHelicopter() {
        // OPTIMIZED helicopter - fewer parts, basic materials, single light
        const heli = new THREE.Group();

        const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        const accentMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // Main fuselage
        const fuselageGeo = new THREE.BoxGeometry(8, 2.5, 3);
        const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
        heli.add(fuselage);

        // Nose
        const noseGeo = new THREE.ConeGeometry(1.5, 3, 6);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.rotation.z = -Math.PI / 2;
        nose.position.set(5.5, 0, 0);
        heli.add(nose);

        // Tail boom
        const tailGeo = new THREE.BoxGeometry(8, 1, 1);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(-8, 0.5, 0);
        heli.add(tail);

        // Tail fin
        const finGeo = new THREE.BoxGeometry(0.2, 2.5, 2);
        const fin = new THREE.Mesh(finGeo, accentMat);
        fin.position.set(-11.5, 1.5, 0);
        heli.add(fin);

        // Tail rotor - simplified
        const tailRotor = new THREE.Group();
        const tailBladeGeo = new THREE.BoxGeometry(0.1, 2, 0.2);
        const tailBlade1 = new THREE.Mesh(tailBladeGeo, bodyMat);
        const tailBlade2 = new THREE.Mesh(tailBladeGeo, bodyMat);
        tailBlade2.rotation.z = Math.PI / 2;
        tailRotor.add(tailBlade1);
        tailRotor.add(tailBlade2);
        tailRotor.position.set(-11.5, 1.5, 1.4);
        tailRotor.rotation.x = Math.PI / 2;
        heli.add(tailRotor);
        heli.tailRotor = tailRotor;

        // Main rotor - simplified to 2 blades
        const mainRotor = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(20, 0.1, 0.8);
        const blade = new THREE.Mesh(bladeGeo, bodyMat);
        mainRotor.add(blade);
        mainRotor.position.set(0, 2.5, 0);
        heli.add(mainRotor);
        heli.mainRotor = mainRotor;

        // Landing skids - simplified
        const skidMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const skidGeo = new THREE.BoxGeometry(6, 0.2, 0.2);
        const skidL = new THREE.Mesh(skidGeo, skidMat);
        skidL.position.set(0, -1.8, 1.2);
        heli.add(skidL);
        const skidR = new THREE.Mesh(skidGeo, skidMat);
        skidR.position.set(0, -1.8, -1.2);
        heli.add(skidR);

        // Single police light (alternates color)
        const policeLight = new THREE.PointLight(0xff0000, 2, 15);
        policeLight.position.set(-2, 1.5, 0);
        heli.add(policeLight);
        heli.policeLight = policeLight;

        return heli;
    }

    createHelicopters() {
        // Create 3 police helicopters
        for (let i = 0; i < 2; i++) {
            const heli = this.createHelicopter();

            // Position helicopters around the track
            const angle = (i / 3) * Math.PI * 2;
            heli.position.set(
                Math.cos(angle) * 150,
                40 + i * 10,
                Math.sin(angle) * 150
            );

            heli.targetCar = null;
            heli.missileTimer = 0;
            heli.missileCooldown = 3000 + Math.random() * 2000; // 3-5 seconds between missiles
            heli.lastMissileTime = 0;
            heli.chaseOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                25 + Math.random() * 10,
                (Math.random() - 0.5) * 10
            );

            this.helicopters.push(heli);
            this.scene.add(heli);
            this.registerCullable(heli);
        }
    }

    createGhost(size, scaryLevel) {
        // OPTIMIZED ghost - fewer polygons, single light
        const ghost = new THREE.Group();
        const scale = 1.0 + size * 0.8;

        // Ghost colors
        const ghostColors = [
            { main: 0x88ff88, glow: 0x00ff00, eye: 0xff0000 },
            { main: 0x8888ff, glow: 0x0000ff, eye: 0xff0000 },
            { main: 0xff4444, glow: 0xff0000, eye: 0xffff00 },
            { main: 0xaa00aa, glow: 0xff00ff, eye: 0x00ffff },
            { main: 0x222222, glow: 0x660000, eye: 0xff0000 }
        ];
        const colorSet = ghostColors[Math.min(scaryLevel - 1, 4)];

        // Simple body material
        const bodyMat = new THREE.MeshBasicMaterial({
            color: colorSet.main,
            transparent: true,
            opacity: 0.6
        });

        // Main body - low poly sphere
        const bodyGeo = new THREE.SphereGeometry(1.2 * scale, 8, 6);
        bodyGeo.scale(1, 1.4, 1);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 2 * scale;
        ghost.add(body);

        // Simple tendrils - just 4
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const tendrilGeo = new THREE.ConeGeometry(0.3 * scale, 1.5 * scale, 4);
            const tendril = new THREE.Mesh(tendrilGeo, bodyMat);
            tendril.position.set(
                Math.cos(angle) * 0.6 * scale,
                0.5 * scale,
                Math.sin(angle) * 0.6 * scale
            );
            tendril.rotation.x = Math.PI;
            ghost.add(tendril);
        }

        // Eyes - simple glowing spheres
        const eyeMat = new THREE.MeshBasicMaterial({ color: colorSet.eye });
        const eyeGeo = new THREE.SphereGeometry(0.2 * scale, 6, 6);

        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.4 * scale, 2.4 * scale, 1.0 * scale);
        ghost.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.4 * scale, 2.4 * scale, 1.0 * scale);
        ghost.add(eyeR);

        // Mouth - simple black shape
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        if (scaryLevel >= 3) {
            // Scary jagged mouth
            const mouthGeo = new THREE.PlaneGeometry(0.8 * scale, 0.3 * scale);
            const mouth = new THREE.Mesh(mouthGeo, mouthMat);
            mouth.position.set(0, 1.7 * scale, 1.1 * scale);
            ghost.add(mouth);

            // Few teeth
            const teethMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
            for (let t = 0; t < 4; t++) {
                const toothGeo = new THREE.ConeGeometry(0.06 * scale, 0.2 * scale, 3);
                const tooth = new THREE.Mesh(toothGeo, teethMat);
                tooth.position.set(-0.3 * scale + t * 0.2 * scale, 1.8 * scale, 1.12 * scale);
                tooth.rotation.x = Math.PI;
                ghost.add(tooth);
            }
        } else {
            // Simple oval mouth
            const mouthGeo = new THREE.CircleGeometry(0.2 * scale, 8);
            const mouth = new THREE.Mesh(mouthGeo, mouthMat);
            mouth.position.set(0, 1.6 * scale, 1.1 * scale);
            ghost.add(mouth);
        }

        // Arms for scary ghosts - simplified
        if (scaryLevel >= 3) {
            const armMat = bodyMat.clone();
            const armGeo = new THREE.CylinderGeometry(0.1 * scale, 0.15 * scale, 1.2 * scale, 4);

            const armL = new THREE.Mesh(armGeo, armMat);
            armL.position.set(-1.2 * scale, 2 * scale, 0.5 * scale);
            armL.rotation.z = Math.PI / 3;
            ghost.add(armL);

            const armR = new THREE.Mesh(armGeo, armMat);
            armR.position.set(1.2 * scale, 2 * scale, 0.5 * scale);
            armR.rotation.z = -Math.PI / 3;
            ghost.add(armR);
        }

        // Horns for level 4+
        if (scaryLevel >= 4) {
            const hornMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const hornGeo = new THREE.ConeGeometry(0.1 * scale, 0.5 * scale, 4);

            const hornL = new THREE.Mesh(hornGeo, hornMat);
            hornL.position.set(-0.5 * scale, 3.1 * scale, 0.3 * scale);
            hornL.rotation.z = 0.3;
            ghost.add(hornL);

            const hornR = new THREE.Mesh(hornGeo, hornMat);
            hornR.position.set(0.5 * scale, 3.1 * scale, 0.3 * scale);
            hornR.rotation.z = -0.3;
            ghost.add(hornR);
        }

        // Single glow sphere
        const glowGeo = new THREE.SphereGeometry(2 * scale, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: colorSet.glow,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 2 * scale;
        ghost.add(glow);
        ghost.glow = glow;

        // SINGLE light per ghost (big performance save)
        const light = new THREE.PointLight(colorSet.glow, 1.5, 12 * scale);
        light.position.y = 2 * scale;
        ghost.add(light);
        ghost.light = light;

        // Properties
        ghost.size = size;
        ghost.scaryLevel = scaryLevel;
        ghost.damage = 5 + scaryLevel * 8 + size * 5;
        ghost.baseY = 2;
        ghost.floatOffset = Math.random() * Math.PI * 2;
        ghost.rotationSpeed = 0.02 + scaryLevel * 0.01;
        ghost.collected = false;

        return ghost;
    }

    createGhosts() {
        // Spawn initial ghosts - always maintain maxGhosts count
        for (let i = 0; i < this.maxGhosts; i++) {
            this.spawnGhost();
        }
    }

    spawnGhost() {
        // Avoid spawning on the straight start section
        let trackIndex;
        do {
            trackIndex = Math.floor(Math.random() * this.trackPoints.length);
        } while (trackIndex < this.straightSectionEnd);
        const trackPoint = this.trackPoints[trackIndex];

        const offset = (Math.random() - 0.5) * 15;
        const nextPoint = this.trackPoints[(trackIndex + 1) % this.trackPoints.length];
        const dir = new THREE.Vector3().subVectors(nextPoint, trackPoint).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);

        const sizeRoll = Math.random();
        let size, scaryLevel;

        if (sizeRoll < 0.5) {
            size = 1;
            scaryLevel = 1 + Math.floor(Math.random() * 2);
        } else if (sizeRoll < 0.8) {
            size = 2;
            scaryLevel = 2 + Math.floor(Math.random() * 2);
        } else {
            size = 3;
            scaryLevel = 3 + Math.floor(Math.random() * 2);
        }

        if (Math.random() < 0.1) {
            size = 4;
            scaryLevel = 5;
        }

        const ghost = this.createGhost(size, scaryLevel);

        ghost.position.copy(trackPoint);
        ghost.position.add(perp.multiplyScalar(offset));
        ghost.position.y = 2 + size;

        this.ghosts.push(ghost);
        this.scene.add(ghost);
    }

    updateGhosts() {
        if (!this.gameStarted) return;

        const time = Date.now() * 0.001;
        const playerX = this.playerCar.position.x;
        const playerZ = this.playerCar.position.z;
        const playerDestroyed = this.playerCar.destroyed;

        for (let i = 0; i < this.ghosts.length; i++) {
            const ghost = this.ghosts[i];
            if (ghost.collected) continue;

            const gx = ghost.position.x;
            const gz = ghost.position.z;

            // Only animate visible ghosts
            if (ghost.visible) {
                // Simple float animation
                ghost.position.y = ghost.baseY + ghost.size + Math.sin(time * 2 + ghost.floatOffset) * 0.5;
                ghost.rotation.y += ghost.rotationSpeed;
            }

            const hitRadiusSq = (3 + ghost.size * 1.5) * (3 + ghost.size * 1.5);

            // Check collision with player car
            if (!playerDestroyed) {
                const dx = gx - playerX;
                const dz = gz - playerZ;
                if (dx * dx + dz * dz < hitRadiusSq) {
                    this.ghostHit(ghost, this.playerCar);
                    continue;
                }
            }

            // Check collision with AI cars
            for (let j = 0; j < this.aiCars.length; j++) {
                const car = this.aiCars[j];
                if (car.destroyed) continue;
                const dx = gx - car.position.x;
                const dz = gz - car.position.z;
                if (dx * dx + dz * dz < hitRadiusSq) {
                    this.ghostHit(ghost, car);
                    break;
                }
            }
        }
    }

    ghostHit(ghost, car) {
        if (ghost.collected || car.destroyed) return;

        ghost.collected = true;
        this.ghostsCollected++;

        // Create ghost hit effect for ALL cars
        this.createGhostHitEffect(ghost.position.clone(), car);

        // Remove ghost from scene and array
        this.scene.remove(ghost);
        const idx = this.ghosts.indexOf(ghost);
        if (idx > -1) {
            this.ghosts.splice(idx, 1);
        }

        // Schedule respawn after 5 seconds
        setTimeout(() => {
            if (!this.gameOver) {
                this.spawnGhost();
            }
        }, this.ghostRespawnTime);

        // Apply damage using unified damage system
        this.applyDamage(car, ghost.damage, 'ghost');
    }

    createGhostHitEffect(position, car) {
        // Purple/red spooky particles
        const colors = [0xff00ff, 0xff0066, 0xaa00ff, 0xff3399];
        const numParticles = 25;

        for (let i = 0; i < numParticles; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 6, 6),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
            );

            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.6,
                Math.random() * 0.4 + 0.1,
                (Math.random() - 0.5) * 0.6
            );
            particle.life = 1;
            particle.decay = 0.025 + Math.random() * 0.015;

            this.scene.add(particle);
            this.pickupEffects.push(particle);
        }

        // Spooky expanding ring
        const ringGeo = new THREE.RingGeometry(0.5, 1.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(position);
        ring.rotation.x = -Math.PI / 2;
        ring.expandSpeed = 0.4;
        ring.life = 1;
        ring.decay = 0.04;
        ring.isRing = true;
        this.scene.add(ring);
        this.pickupEffects.push(ring);

        // Floating damage text for ALL cars
        this.createFloatingText(car, 'HAUNTED!', 0xff00ff);

        // Play ghost sound
        this.playSound('ghost', 0.4);
    }

    // Pickup items system
    createPickups() {
        for (let i = 0; i < this.maxPickups; i++) {
            this.spawnPickup();
        }
    }

    spawnPickup() {
        // Random position on track (avoid start section)
        let trackIndex;
        do {
            trackIndex = Math.floor(Math.random() * this.trackPoints.length);
        } while (trackIndex < this.straightSectionEnd);

        const trackPoint = this.trackPoints[trackIndex];
        const nextPoint = this.trackPoints[(trackIndex + 1) % this.trackPoints.length];
        const dir = new THREE.Vector3().subVectors(nextPoint, trackPoint).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        const offset = (Math.random() - 0.5) * 25;

        // Random type: health or shield
        const isHealth = Math.random() < 0.6;
        const pickup = this.createPickupMesh(isHealth);

        pickup.position.copy(trackPoint);
        pickup.position.add(perp.clone().multiplyScalar(offset));
        pickup.position.y = 2;

        pickup.pickupType = isHealth ? 'health' : 'shield';
        pickup.collected = false;
        pickup.floatOffset = Math.random() * Math.PI * 2;
        pickup.rotationSpeed = 0.03 + Math.random() * 0.02;

        this.pickups.push(pickup);
        this.scene.add(pickup);
    }

    createPickupMesh(isHealth) {
        const group = new THREE.Group();

        if (isHealth) {
            // Health pickup - green cross/plus
            const color = 0x00ff44;
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });

            // Vertical bar
            const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 0.8), mat);
            group.add(vBar);

            // Horizontal bar
            const hBar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.8), mat);
            group.add(hBar);

            // Glow sphere
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.3 });
            const glow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), glowMat);
            group.add(glow);

            // Outer ring
            const ringGeo = new THREE.TorusGeometry(2, 0.15, 8, 32);
            const ring = new THREE.Mesh(ringGeo, mat);
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        } else {
            // Shield pickup - blue hexagon/diamond
            const color = 0x00aaff;
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });

            // Diamond shape
            const diamondGeo = new THREE.OctahedronGeometry(1.5, 0);
            const diamond = new THREE.Mesh(diamondGeo, mat);
            diamond.scale.set(1, 1.5, 1);
            group.add(diamond);

            // Glow sphere
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.3 });
            const glow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), glowMat);
            group.add(glow);

            // Orbiting rings
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
            const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 8, 32), ringMat);
            ring1.rotation.x = Math.PI / 3;
            group.add(ring1);

            const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 8, 32), ringMat);
            ring2.rotation.x = -Math.PI / 3;
            ring2.rotation.y = Math.PI / 2;
            group.add(ring2);
        }

        return group;
    }

    updatePickups() {
        if (!this.gameStarted) return;

        const time = Date.now() * 0.001;

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pickup = this.pickups[i];
            if (pickup.collected) continue;

            // Floating and rotating animation
            pickup.position.y = 2 + Math.sin(time * 2 + pickup.floatOffset) * 0.5;
            pickup.rotation.y += pickup.rotationSpeed;

            const pickupX = pickup.position.x;
            const pickupZ = pickup.position.z;
            const hitRadiusSq = 16; // 4 units radius

            // Check collision with player
            if (!this.playerCar.destroyed) {
                const dx = pickupX - this.playerCar.position.x;
                const dz = pickupZ - this.playerCar.position.z;
                if (dx * dx + dz * dz < hitRadiusSq) {
                    this.collectPickup(pickup, this.playerCar);
                    continue;
                }
            }

            // Check collision with AI cars
            for (const car of this.aiCars) {
                if (car.destroyed) continue;
                const dx = pickupX - car.position.x;
                const dz = pickupZ - car.position.z;
                if (dx * dx + dz * dz < hitRadiusSq) {
                    this.collectPickup(pickup, car);
                    break;
                }
            }
        }

        // Update pickup effects
        this.updatePickupEffects();
    }

    collectPickup(pickup, car) {
        if (pickup.collected) return;
        pickup.collected = true;

        // Create collection effect for ALL cars
        this.createPickupCollectEffect(pickup.position.clone(), pickup.pickupType);

        // Apply pickup effect
        if (pickup.pickupType === 'health') {
            const healAmount = 15 + Math.floor(Math.random() * 20); // 15-35 health
            car.health = Math.min(car.health + healAmount, 100);

            // Play health pickup sound
            this.playSound('health', 0.4);

            // Create floating text effect for ALL cars
            this.createFloatingText(car, '+' + healAmount + ' HP', 0x00ff44);

            if (car.isPlayer) {
                this.updateHealthDisplay();
                this.showPickupText('+' + healAmount + ' HP', '#00ff44');
            }
        } else {
            // Shield - 5 seconds of protection
            car.shieldActive = true;
            car.shieldEndTime = Date.now() + 5000;

            // Play shield pickup sound
            this.playSound('shield', 0.4);

            // Create shield visual on car
            this.createCarShield(car);

            // Create floating text effect for ALL cars
            this.createFloatingText(car, 'SHIELD', 0x00aaff);

            if (car.isPlayer) {
                this.showPickupText('SHIELD 5s', '#00aaff');
            }
        }

        // Remove pickup
        this.scene.remove(pickup);
        const idx = this.pickups.indexOf(pickup);
        if (idx > -1) this.pickups.splice(idx, 1);

        // Respawn after delay
        setTimeout(() => {
            if (!this.gameOver && !this.raceFinished) {
                this.spawnPickup();
            }
        }, 8000);
    }

    createCarShield(car) {
        // Remove existing shield if any
        if (car.shieldMesh) {
            car.remove(car.shieldMesh);
        }

        // Create shield bubble around car
        const shieldGeo = new THREE.SphereGeometry(5, 16, 16);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.position.y = 1;
        car.add(shield);
        car.shieldMesh = shield;
    }

    updateCarShields() {
        const now = Date.now();

        // Check player shield
        if (this.playerCar.shieldActive && now >= this.playerCar.shieldEndTime) {
            this.playerCar.shieldActive = false;
            if (this.playerCar.shieldMesh) {
                this.playerCar.remove(this.playerCar.shieldMesh);
                this.playerCar.shieldMesh = null;
            }
        }

        // Animate player shield
        if (this.playerCar.shieldMesh) {
            this.playerCar.shieldMesh.material.opacity = 0.2 + Math.sin(now * 0.01) * 0.15;
            this.playerCar.shieldMesh.rotation.y += 0.02;
        }

        // Check AI shields
        for (const car of this.aiCars) {
            if (car.shieldActive && now >= car.shieldEndTime) {
                car.shieldActive = false;
                if (car.shieldMesh) {
                    car.remove(car.shieldMesh);
                    car.shieldMesh = null;
                }
            }

            // Animate AI shields
            if (car.shieldMesh) {
                car.shieldMesh.material.opacity = 0.2 + Math.sin(now * 0.01) * 0.15;
                car.shieldMesh.rotation.y += 0.02;
            }
        }
    }

    updateInvincibilityUI() {
        const invEl = document.getElementById('invincibility');
        if (!invEl || !this.raceStartTime) return;

        const elapsed = Date.now() - this.raceStartTime;
        const remaining = Math.max(0, 10000 - elapsed);

        if (remaining > 0) {
            const seconds = Math.ceil(remaining / 1000);
            invEl.textContent = `INVINCIBLE ${seconds}s`;
            invEl.classList.add('show');
        } else {
            invEl.classList.remove('show');
        }
    }

    createFloatingText(car, text, color, duration = 1) {
        // Create 3D floating text above car using sprite
        // duration: 1 = normal, 2 = twice as long, etc.
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Convert hex color to CSS
        const cssColor = '#' + color.toString(16).padStart(6, '0');

        ctx.fillStyle = cssColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeText(text, 128, 32);
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(8, 2, 1);
        sprite.position.copy(car.position);
        sprite.position.y += 5;

        sprite.velocity = 0.08 / duration;
        sprite.life = 1;
        sprite.decay = 0.02 / duration;
        sprite.isSprite = true;

        this.scene.add(sprite);
        this.pickupEffects.push(sprite);
    }

    createPickupCollectEffect(position, type) {
        const color = type === 'health' ? 0x00ff44 : 0x00aaff;
        const numParticles = 20;

        for (let i = 0; i < numParticles; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 6, 6),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
            );

            particle.position.copy(position);
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.3 + 0.2,
                (Math.random() - 0.5) * 0.5
            );
            particle.life = 1;
            particle.decay = 0.02 + Math.random() * 0.02;

            this.scene.add(particle);
            this.pickupEffects.push(particle);
        }

        // Expanding ring effect
        const ringGeo = new THREE.RingGeometry(0.5, 1, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(position);
        ring.rotation.x = -Math.PI / 2;
        ring.expandSpeed = 0.3;
        ring.life = 1;
        ring.decay = 0.03;
        ring.isRing = true;
        this.scene.add(ring);
        this.pickupEffects.push(ring);
    }

    updatePickupEffects() {
        for (let i = this.pickupEffects.length - 1; i >= 0; i--) {
            const effect = this.pickupEffects[i];

            if (effect.isRing) {
                // Expanding ring
                effect.scale.x += effect.expandSpeed;
                effect.scale.y += effect.expandSpeed;
                effect.material.opacity = effect.life * 0.8;
            } else if (effect.isSprite) {
                // Floating text sprite
                effect.position.y += effect.velocity;
                effect.material.opacity = effect.life;
            } else if (effect.velocity && effect.velocity.isVector3) {
                // Particle with Vector3 velocity
                effect.position.add(effect.velocity);
                effect.velocity.y -= 0.01; // Gravity
                effect.material.opacity = effect.life;
                effect.scale.setScalar(effect.life);
            } else {
                // Regular particle
                effect.material.opacity = effect.life;
                effect.scale.setScalar(effect.life);
            }

            effect.life -= effect.decay;

            if (effect.life <= 0) {
                this.scene.remove(effect);
                this.pickupEffects.splice(i, 1);
            }
        }
    }

    showPickupText(text, color) {
        // Create floating text notification
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: bold;
            color: ${color};
            text-shadow: 0 0 20px ${color}, 0 0 40px ${color};
            pointer-events: none;
            z-index: 1000;
            animation: pickupTextAnim 1.5s ease-out forwards;
        `;
        document.body.appendChild(div);

        // Add animation style if not exists
        if (!document.getElementById('pickup-anim-style')) {
            const style = document.createElement('style');
            style.id = 'pickup-anim-style';
            style.textContent = `
                @keyframes pickupTextAnim {
                    0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
                    20% { transform: translate(-50%, -50%) scale(1.2); }
                    40% { transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -100%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => div.remove(), 1500);
    }

    // Unified damage system for all cars
    applyDamage(car, damage, source) {
        if (car.destroyed) return;

        // No damage in first 10 seconds of race
        if (this.raceStartTime && Date.now() - this.raceStartTime < 10000) {
            return; // Invincibility period
        }

        // Shield blocks damage
        if (car.shieldActive) {
            // Create shield hit effect
            this.createShieldHitEffect(car);
            return; // No damage taken
        }

        // Apply damage to car's health
        car.health -= damage;

        // Create floating damage number
        this.createDamageEffect(car, damage);

        // Update UI if player car
        if (car.isPlayer) {
            this.lastDamageSource = source;
            this.updateHealthDisplay();
        }

        // Check if car is destroyed
        if (car.health <= 0) {
            car.health = 0;
            this.destroyCar(car);

            if (car.isPlayer) {
                this.showGameOver();
            }
        }
    }

    createShieldHitEffect(car) {
        // Flash the shield and create sparks
        if (car.shieldMesh) {
            car.shieldMesh.material.opacity = 0.8;
            setTimeout(() => {
                if (car.shieldMesh) car.shieldMesh.material.opacity = 0.3;
            }, 100);
        }

        // Create spark particles
        for (let i = 0; i < 10; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1 })
            );
            spark.position.copy(car.position);
            spark.position.y += 2;
            spark.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 0.8
            );
            spark.life = 1;
            spark.decay = 0.05;
            this.scene.add(spark);
            this.pickupEffects.push(spark);
        }
    }

    createDamageEffect(car, damage) {
        // Create floating damage text using sprite
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Draw damage text
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 8;
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = `-${Math.round(damage)}`;
        ctx.strokeText(text, 128, 64);
        ctx.fillText(text, 128, 64);

        // Create texture and sprite
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMat);

        // Position above car
        sprite.position.copy(car.position);
        sprite.position.y += 5;
        sprite.scale.set(8, 4, 1);

        this.scene.add(sprite);

        // Animate the damage number floating up and fading
        const startY = sprite.position.y;
        const startTime = Date.now();
        const duration = 1500; // 1.5 seconds

        const animateDamage = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                this.scene.remove(sprite);
                texture.dispose();
                spriteMat.dispose();
                return;
            }

            // Float up
            sprite.position.y = startY + progress * 6;

            // Follow car horizontally
            sprite.position.x = car.position.x;
            sprite.position.z = car.position.z;

            // Fade out and scale up
            spriteMat.opacity = 1 - progress;
            const scale = 8 + progress * 4;
            sprite.scale.set(scale, scale / 2, 1);

            requestAnimationFrame(animateDamage);
        };

        animateDamage();

        // Create ghost explosion particles
        this.createGhostExplosion(car.position.clone());
    }

    createGhostExplosion(position) {
        if (!position) return;

        // Create spooky green particle burst
        const particleCount = 10;
        const particles = [];
        const startX = position.x;
        const startY = position.y + 2;
        const startZ = position.z;

        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.3, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x00ff00 : 0x88ff88,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(geo, mat);

            particle.position.set(startX, startY, startZ);

            this.scene.add(particle);
            particles.push({
                mesh: particle,
                mat: mat,
                vx: (Math.random() - 0.5) * 0.4,
                vy: Math.random() * 0.3 + 0.1,
                vz: (Math.random() - 0.5) * 0.4
            });
        }

        // Animate particles
        const startTime = Date.now();
        const duration = 800;
        const scene = this.scene;

        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                for (let i = 0; i < particles.length; i++) {
                    scene.remove(particles[i].mesh);
                    particles[i].mat.dispose();
                    particles[i].mesh.geometry.dispose();
                }
                return;
            }

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.mesh.position.x += p.vx;
                p.mesh.position.y += p.vy;
                p.mesh.position.z += p.vz;
                p.vy -= 0.015; // gravity
                p.mat.opacity = 0.8 * (1 - progress);
                p.mesh.scale.setScalar(1 + progress);
            }

            requestAnimationFrame(animateParticles);
        };

        animateParticles();
    }


    createMissile(startPos, targetCar) {
        const missile = new THREE.Group();

        // Missile body
        const bodyGeo = new THREE.CylinderGeometry(0.2, 0.15, 2, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2;
        missile.add(body);

        // Nose cone
        const noseGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff4400, metalness: 0.5 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.rotation.x = -Math.PI / 2;
        nose.position.z = 1.25;
        missile.add(nose);

        // Fins
        const finGeo = new THREE.BoxGeometry(0.5, 0.05, 0.3);
        const finMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        for (let i = 0; i < 4; i++) {
            const fin = new THREE.Mesh(finGeo, finMat);
            fin.position.z = -0.8;
            fin.rotation.z = (i / 4) * Math.PI * 2;
            fin.position.x = Math.cos((i / 4) * Math.PI * 2) * 0.25;
            fin.position.y = Math.sin((i / 4) * Math.PI * 2) * 0.25;
            missile.add(fin);
        }

        // Rocket flame
        const flameGeo = new THREE.ConeGeometry(0.15, 1, 8);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.rotation.x = Math.PI / 2;
        flame.position.z = -1.5;
        missile.add(flame);
        missile.flame = flame;

        // Flame light
        const flameLight = new THREE.PointLight(0xff4400, 2, 10);
        flameLight.position.z = -1.5;
        missile.add(flameLight);

        // Smoke trail particles will be added in update

        missile.position.copy(startPos);
        missile.target = targetCar;
        missile.velocity = new THREE.Vector3(0, -2, 0);
        missile.speed = 2;
        missile.lifetime = 0;
        missile.maxLifetime = 300; // 5 seconds at 60fps
        missile.trailParticles = [];

        this.missiles.push(missile);
        this.scene.add(missile);

        return missile;
    }

    createExplosion(position) {
        // Play epic explosion sound
        this.playSound('explosion', 0.6);

        const explosion = new THREE.Group();
        explosion.position.copy(position);

        // Multiple explosion spheres
        const colors = [0xff4400, 0xff6600, 0xffaa00, 0xff0000];
        for (let i = 0; i < 8; i++) {
            const size = 1 + Math.random() * 2;
            const geo = new THREE.SphereGeometry(size, 16, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 1
            });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.position.set(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4
            );
            sphere.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.3,
                (Math.random() - 0.5) * 0.5
            );
            explosion.add(sphere);
        }

        // Explosion light
        const light = new THREE.PointLight(0xff4400, 10, 50);
        explosion.add(light);
        explosion.light = light;

        explosion.lifetime = 0;
        explosion.maxLifetime = 60;

        this.explosions.push(explosion);
        this.scene.add(explosion);

        return explosion;
    }

    updateHelicopters() {
        if (!this.gameStarted || this.gameOver) return;

        const time = Date.now();

        for (let index = 0; index < this.helicopters.length; index++) {
            const heli = this.helicopters[index];

            // Always update helicopter position (for chasing), but skip visual updates if not visible
            // Pick a target car to chase - distribute among all cars
            if (!heli.targetCar || heli.targetCar.destroyed) {
                // Get all non-destroyed cars
                const aliveCars = [this.playerCar, ...this.aiCars].filter(c => !c.destroyed);
                if (aliveCars.length > 0) {
                    // Each helicopter tends to chase a different car based on its index
                    const targetIndex = (index + Math.floor(Math.random() * 2)) % aliveCars.length;
                    heli.targetCar = aliveCars[targetIndex];
                }
            }

            if (heli.targetCar) {
                // Move towards target
                const targetX = heli.targetCar.position.x + heli.chaseOffset.x;
                const targetY = heli.targetCar.position.y + heli.chaseOffset.y;
                const targetZ = heli.targetCar.position.z + heli.chaseOffset.z;

                const dx = targetX - heli.position.x;
                const dy = targetY - heli.position.y;
                const dz = targetZ - heli.position.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq > 25) {
                    const dist = Math.sqrt(distSq);
                    const speed = 1.8 / dist;
                    heli.position.x += dx * speed;
                    heli.position.y += dy * speed;
                    heli.position.z += dz * speed;
                }

                // Fire missiles - check distance to target
                const targetDistSq = dx * dx + dz * dz;
                if (time - heli.lastMissileTime > heli.missileCooldown && targetDistSq < 10000) {
                    const missileStart = heli.position.clone();
                    missileStart.y -= 2;
                    this.createMissile(missileStart, heli.targetCar);
                    heli.lastMissileTime = time;
                    heli.missileCooldown = 3000 + Math.random() * 2000;

                    // Switch target occasionally
                    if (Math.random() < 0.3) {
                        heli.targetCar = null;
                    }
                }
            }

            // Only do visual updates if visible
            if (heli.visible) {
                // Rotate rotors
                heli.mainRotor.rotation.y += 0.5;
                heli.tailRotor.rotation.z += 0.8;

                // Flash police light
                const flashRate = Math.sin(time * 0.01 + index) > 0;
                heli.policeLight.color.setHex(flashRate ? 0xff0000 : 0x0000ff);

                // Face target
                if (heli.targetCar) {
                    heli.lookAt(heli.targetCar.position.x, heli.position.y, heli.targetCar.position.z);
                }

                // Hover motion
                heli.position.y += Math.sin(time * 0.002 + index) * 0.02;
            }
        }
    }

    updateMissiles() {
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const missile = this.missiles[i];
            missile.lifetime++;

            // Home in on target
            if (missile.target && !missile.target.destroyed) {
                const targetX = missile.target.position.x;
                const targetY = missile.target.position.y + 1;
                const targetZ = missile.target.position.z;

                const dx = targetX - missile.position.x;
                const dy = targetY - missile.position.y;
                const dz = targetZ - missile.position.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist > 0.1) {
                    // Gradually adjust velocity towards target
                    missile.velocity.x += (dx / dist * missile.speed - missile.velocity.x) * 0.05;
                    missile.velocity.y += (dy / dist * missile.speed - missile.velocity.y) * 0.05;
                    missile.velocity.z += (dz / dist * missile.speed - missile.velocity.z) * 0.05;
                }
            }

            missile.position.x += missile.velocity.x;
            missile.position.y += missile.velocity.y;
            missile.position.z += missile.velocity.z;

            // Only do visual updates if visible
            if (missile.visible) {
                // Orient missile towards velocity
                const lookTarget = missile.position.clone().add(missile.velocity);
                missile.lookAt(lookTarget);

                // Animate flame
                missile.flame.scale.setScalar(0.8 + Math.random() * 0.4);

                // Create fewer smoke particles
                if (missile.lifetime % 6 === 0 && missile.trailParticles.length < 10) {
                    const smoke = new THREE.Mesh(
                        new THREE.SphereGeometry(0.3, 4, 4),
                        new THREE.MeshBasicMaterial({
                            color: 0x888888,
                            transparent: true,
                            opacity: 0.4
                        })
                    );
                    smoke.position.copy(missile.position);
                    smoke.lifetime = 0;
                    missile.trailParticles.push(smoke);
                    this.scene.add(smoke);
                }
            }

            // Update smoke trail (always, for cleanup)
            for (let j = missile.trailParticles.length - 1; j >= 0; j--) {
                const smoke = missile.trailParticles[j];
                smoke.lifetime++;
                if (smoke.lifetime > 20) {
                    this.scene.remove(smoke);
                    missile.trailParticles.splice(j, 1);
                } else {
                    smoke.scale.multiplyScalar(1.03);
                    smoke.material.opacity -= 0.025;
                }
            }

            // Check collision with player car first (most important)
            if (!this.playerCar.destroyed) {
                const dx = missile.position.x - this.playerCar.position.x;
                const dy = missile.position.y - this.playerCar.position.y;
                const dz = missile.position.z - this.playerCar.position.z;
                if (dx * dx + dy * dy + dz * dz < 16) {
                    this.createExplosion(missile.position);
                    this.destroyMissile(missile, i);
                    this.applyDamage(this.playerCar, 35, 'helicopter');
                    continue;
                }
            }

            // Check AI cars
            for (let j = 0; j < this.aiCars.length; j++) {
                const car = this.aiCars[j];
                if (car.destroyed) continue;
                const dx = missile.position.x - car.position.x;
                const dy = missile.position.y - car.position.y;
                const dz = missile.position.z - car.position.z;
                if (dx * dx + dy * dy + dz * dz < 16) {
                    this.createExplosion(missile.position);
                    this.destroyMissile(missile, i);
                    this.applyDamage(car, 35, 'helicopter');
                    break;
                }
            }

            // Check if missile expired or hit ground
            if (missile.lifetime > missile.maxLifetime || missile.position.y < 0) {
                if (missile.position.y < 2) {
                    this.createExplosion(missile.position);
                }
                this.destroyMissile(missile, i);
            }
        }
    }

    destroyMissile(missile, index) {
        // Clean up trail particles
        missile.trailParticles.forEach(smoke => this.scene.remove(smoke));
        this.scene.remove(missile);
        this.missiles.splice(index, 1);
    }

    destroyCar(car) {
        car.destroyed = true;
        this.createExplosion(car.position);

        // Make car look destroyed (darken it, add fire)
        car.traverse(child => {
            if (child.material) {
                child.material.color.setHex(0x222222);
                child.material.emissive = new THREE.Color(0x331100);
            }
        });

        // Add persistent fire
        const fireLight = new THREE.PointLight(0xff4400, 2, 10);
        fireLight.position.y = 2;
        car.add(fireLight);
    }

    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            explosion.lifetime++;

            // Remove when done
            if (explosion.lifetime >= explosion.maxLifetime) {
                this.scene.remove(explosion);
                this.explosions.splice(i, 1);
                continue;
            }

            // Only animate if visible
            if (!explosion.visible) continue;

            const progress = explosion.lifetime / explosion.maxLifetime;

            // Expand and fade spheres
            for (let j = 0; j < explosion.children.length; j++) {
                const child = explosion.children[j];
                if (child.isMesh) {
                    child.scale.multiplyScalar(1.05);
                    child.material.opacity = 1 - progress;
                    if (child.velocity) {
                        child.position.x += child.velocity.x;
                        child.position.y += child.velocity.y;
                        child.position.z += child.velocity.z;
                    }
                }
            }

            // Fade light
            if (explosion.light) {
                explosion.light.intensity = 10 * (1 - progress);
            }
        }
    }

    createNitroTrail(car) {
        // Create flame particles behind the car
        const numParticles = 3;
        for (let i = 0; i < numParticles; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 6, 6),
                new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0x00ffff : (Math.random() > 0.5 ? 0x0088ff : 0xffffff),
                    transparent: true,
                    opacity: 0.9
                })
            );

            // Position behind car
            const offsetX = (Math.random() - 0.5) * 1.5;
            const offsetZ = -2 - Math.random();
            particle.position.set(
                car.position.x - Math.sin(car.rotation.y) * offsetZ + Math.cos(car.rotation.y) * offsetX,
                car.position.y + 0.3 + Math.random() * 0.3,
                car.position.z - Math.cos(car.rotation.y) * offsetZ - Math.sin(car.rotation.y) * offsetX
            );

            particle.velocity = {
                x: -Math.sin(car.rotation.y) * (-0.3 - Math.random() * 0.2) + (Math.random() - 0.5) * 0.1,
                y: 0.05 + Math.random() * 0.05,
                z: -Math.cos(car.rotation.y) * (-0.3 - Math.random() * 0.2) + (Math.random() - 0.5) * 0.1
            };
            particle.lifetime = 0;
            particle.maxLifetime = 20 + Math.random() * 10;

            this.scene.add(particle);
            this.nitroTrails.push(particle);
        }
    }

    updateNitroTrails() {
        for (let i = this.nitroTrails.length - 1; i >= 0; i--) {
            const particle = this.nitroTrails[i];
            particle.lifetime++;

            if (particle.lifetime >= particle.maxLifetime) {
                this.scene.remove(particle);
                this.nitroTrails.splice(i, 1);
                continue;
            }

            // Move and fade
            particle.position.x += particle.velocity.x;
            particle.position.y += particle.velocity.y;
            particle.position.z += particle.velocity.z;

            const progress = particle.lifetime / particle.maxLifetime;
            particle.material.opacity = 0.9 * (1 - progress);
            particle.scale.multiplyScalar(1.03);
        }
    }

    updateHealthDisplay() {
        if (!this.playerCar) return;

        const healthEl = document.getElementById('health-fill');
        const warningEl = document.getElementById('warning-overlay');

        // Calculate health percentage from car's health
        const currentHealth = Math.max(0, this.playerCar.health);
        const maxHealth = this.playerCar.maxHealth || 100;
        const healthPercent = (currentHealth / maxHealth) * 100;

        if (healthEl) {
            healthEl.style.width = healthPercent + '%';

            // Change color based on health level
            if (healthPercent < 30) {
                healthEl.style.background = 'linear-gradient(90deg, #ff0000, #ff4400)';
            } else if (healthPercent < 60) {
                healthEl.style.background = 'linear-gradient(90deg, #ff4400, #ffaa00)';
            } else {
                healthEl.style.background = 'linear-gradient(90deg, #ff4444, #ff8800)';
            }
        }
        if (warningEl) {
            if (healthPercent < 40) {
                warningEl.classList.add('danger');
            } else {
                warningEl.classList.remove('danger');
            }
        }
    }

    showGameOver() {
        this.gameOver = true;
        const gameOverEl = document.getElementById('game-over');
        const titleEl = document.getElementById('game-over-title');
        const msgEl = document.getElementById('game-over-msg');

        if (titleEl && msgEl) {
            if (this.lastDamageSource === 'ghost') {
                titleEl.textContent = 'HAUNTED';
                titleEl.style.color = '#00ff00';
                titleEl.style.textShadow = '0 0 50px #00ff00, 0 0 100px #00aa00';
                msgEl.textContent = 'Your car was destroyed by a ghost!';
            } else if (this.lastDamageSource === 'helicopter') {
                titleEl.textContent = 'WASTED';
                titleEl.style.color = '#ff0000';
                titleEl.style.textShadow = '0 0 50px #ff0000, 0 0 100px #ff4400';
                msgEl.textContent = 'Your car was destroyed by police helicopters!';
            } else if (this.lastDamageSource === 'collision') {
                titleEl.textContent = 'CRASHED';
                titleEl.style.color = '#ff6600';
                titleEl.style.textShadow = '0 0 50px #ff6600, 0 0 100px #ff3300';
                msgEl.textContent = 'Your car was wrecked in a collision with another car!';
            } else if (this.lastDamageSource === 'barrier') {
                titleEl.textContent = 'TOTALED';
                titleEl.style.color = '#ffcc00';
                titleEl.style.textShadow = '0 0 50px #ffcc00, 0 0 100px #ff9900';
                msgEl.textContent = 'Your car crashed into the barrier!';
            } else {
                titleEl.textContent = 'WASTED';
                titleEl.style.color = '#ff0000';
                titleEl.style.textShadow = '0 0 50px #ff0000, 0 0 100px #ff4400';
                msgEl.textContent = 'Your car was destroyed!';
            }
        }

        if (gameOverEl) {
            gameOverEl.classList.add('show');
        }

        // Show restart button
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.style.display = 'block';
        }
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ') e.preventDefault();
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    countdown() {
        const countdownEl = document.getElementById('countdown');
        let count = 3;

        // Start rendering the scene during countdown
        const renderDuringCountdown = () => {
            if (!this.gameStarted) {
                // Update camera position
                this.updateCamera();
                // Render the scene
                this.renderer.render(this.scene, this.camera);
                requestAnimationFrame(renderDuringCountdown);
            }
        };
        renderDuringCountdown();

        // Create intro story overlay
        const introOverlay = document.createElement('div');
        introOverlay.id = 'intro-overlay';
        introOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px;
            box-sizing: border-box;
            overflow-y: auto;
        `;

        introOverlay.innerHTML = `
            <div style="max-width: 750px; text-align: center;">
                <h1 style="font-size: 52px; color: #ff4400; text-shadow: 0 0 30px #ff4400, 0 0 60px #ff0000; margin-bottom: 10px; letter-spacing: 4px;">
                    STREET RACING 3D
                </h1>
                <div style="font-size: 16px; color: #ffaa00; margin-bottom: 20px; letter-spacing: 2px;">
                    ~ A TOTALLY LEGITIMATE RACING STORY ~
                </div>
                <div style="font-size: 14px; color: #fff; line-height: 1.7; text-align: left; background: rgba(255,68,0,0.1); padding: 20px; border-radius: 15px; border: 2px solid #ff4400;">
                    <p style="margin-bottom: 12px;">
                        🏎️ <span style="color: #00aaff;">You are a "totally innocent" street racer</span> who accidentally wandered onto a haunted, police-surveilled track.
                    </p>
                    <p style="margin-bottom: 12px;">
                        🚁 <span style="color: #ff4444;">Police helicopters</span> think you're a criminal and are launching missiles. Terrible aim, unlimited ammo. Classic cops.
                    </p>
                    <p style="margin-bottom: 12px;">
                        👻 <span style="color: #ff00ff;">The ghosts?</span> Spirits of racers who crashed reading the leaderboard. Spooky AND ironic.
                    </p>
                    <p style="margin-bottom: 12px;">
                        💚 <span style="color: #00ff44;">Health</span> and 🛡️ <span style="color: #00aaff;">Shield</span> pickups spawn on track. Grab them or watch AI steal them!
                    </p>
                    <p style="margin-bottom: 0;">
                        🏁 <span style="color: #ffff00;">Complete 10 LAPS to win!</span> First 10s = invincible. After that... good luck! 😈
                    </p>
                </div>
                <div style="margin-top: 15px; font-size: 13px; color: #888;">
                    <span style="color: #00ffff;">WASD/Arrows</span> = Drive | <span style="color: #00ffff;">SPACE</span> = Nitro | <span style="color: #ff4444;">Don't rear-end cars (10x damage!)</span>
                </div>
                <div id="click-to-start-btn" style="margin-top: 25px; font-size: 36px; color: #ff4400; text-shadow: 0 0 20px #ff4400, 0 0 40px #ff0000; cursor: pointer; letter-spacing: 4px; padding: 15px 35px; border: 3px solid #ff4400; border-radius: 15px; background: rgba(255,68,0,0.2); display: inline-block;">
                    🖱️ CLICK TO START 🖱️
                </div>
            </div>
        `;

        document.body.appendChild(introOverlay);

        const startRace = (e) => {
            // Only start race if clicking the button
            const btn = document.getElementById('click-to-start-btn');
            if (!btn.contains(e.target) && e.target !== btn) {
                return;
            }

            // Initialize audio on click
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                // Resume audio context (required by browsers)
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                const ctx = this.audioContext;

                // Create realistic V8 engine sound with multiple harmonics
                this.engineMasterGain = ctx.createGain();
                this.engineMasterGain.gain.value = 0;
                this.engineMasterGain.connect(ctx.destination);

                this.engineCompressor = ctx.createDynamicsCompressor();
                this.engineCompressor.threshold.value = -24;
                this.engineCompressor.knee.value = 30;
                this.engineCompressor.ratio.value = 12;
                this.engineCompressor.attack.value = 0.003;
                this.engineCompressor.release.value = 0.25;
                this.engineCompressor.connect(this.engineMasterGain);

                this.engineFilter = ctx.createBiquadFilter();
                this.engineFilter.type = 'lowpass';
                this.engineFilter.frequency.value = 800;
                this.engineFilter.Q.value = 1;
                this.engineFilter.connect(this.engineCompressor);

                this.engineOscillators = [];
                this.engineGains = [];

                const harmonics = [
                    { type: 'sawtooth', freqMult: 1, gain: 0.4 },
                    { type: 'square', freqMult: 0.5, gain: 0.3 },
                    { type: 'sawtooth', freqMult: 2, gain: 0.2 },
                    { type: 'triangle', freqMult: 4, gain: 0.1 },
                    { type: 'sawtooth', freqMult: 0.25, gain: 0.15 }
                ];

                harmonics.forEach(h => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = h.type;
                    osc.frequency.value = 40;
                    gain.gain.value = h.gain;
                    osc.connect(gain);
                    gain.connect(this.engineFilter);
                    osc.start();
                    this.engineOscillators.push({ osc, freqMult: h.freqMult });
                    this.engineGains.push(gain);
                });

                const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
                const noiseData = noiseBuffer.getChannelData(0);
                for (let i = 0; i < noiseData.length; i++) {
                    noiseData[i] = (Math.random() * 2 - 1) * 0.5;
                }
                this.engineNoise = ctx.createBufferSource();
                this.engineNoise.buffer = noiseBuffer;
                this.engineNoise.loop = true;
                this.engineNoiseGain = ctx.createGain();
                this.engineNoiseGain.gain.value = 0;
                this.engineNoiseFilter = ctx.createBiquadFilter();
                this.engineNoiseFilter.type = 'bandpass';
                this.engineNoiseFilter.frequency.value = 500;
                this.engineNoiseFilter.Q.value = 0.5;
                this.engineNoise.connect(this.engineNoiseFilter);
                this.engineNoiseFilter.connect(this.engineNoiseGain);
                this.engineNoiseGain.connect(this.engineCompressor);
                this.engineNoise.start();

                // Start idle engine sound
                this.startIdleEngine();
            }

            // Remove intro overlay
            if (introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }

            // Reset countdown element styling
            countdownEl.style.fontSize = '150px';
            countdownEl.style.color = '#fff';

            document.removeEventListener('click', startRace);

            const doCount = () => {
                if (count > 0) {
                    countdownEl.textContent = count;
                    countdownEl.classList.add('show');
                    // Play countdown beep
                    this.playSound('countdown', 0.5);
                    setTimeout(() => {
                        countdownEl.classList.remove('show');
                        count--;
                        setTimeout(doCount, 300);
                    }, 700);
                } else {
                    countdownEl.textContent = 'GO!';
                    countdownEl.style.color = '#00ff00';
                    countdownEl.classList.add('show');
                    // Play GO! sound with rev burst
                    this.playSound('countdown_go', 0.6);
                    this.gameStarted = true;
                    this.raceStartTime = Date.now();
                    setTimeout(() => {
                        countdownEl.classList.remove('show');
                        this.animate();
                    }, 1000);
                }
            };

            // Start countdown after a short delay so idle engine is heard first
            setTimeout(doCount, 800);
        };

        // Only click to start, no keyboard
        document.addEventListener('click', startRace);
    }

    updatePlayerCar() {
        if (!this.gameStarted || this.gameOver) return;

        const car = this.playerCar;

        // Acceleration
        if (this.keys['w'] || this.keys['arrowup']) {
            this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
        } else if (this.keys['s'] || this.keys['arrowdown']) {
            this.speed = Math.max(this.speed - this.acceleration * 2, -50);
        } else {
            // Natural deceleration
            if (this.speed > 0) {
                this.speed = Math.max(this.speed - this.deceleration, 0);
            } else if (this.speed < 0) {
                this.speed = Math.min(this.speed + this.deceleration, 0);
            }
        }

        // Nitro Boost System - 10s boost to 200 speed, 30s cooldown
        const now = Date.now();

        // Check if boost just ended
        if (this.nitroBoostActive && now >= this.nitroBoostEndTime) {
            this.nitroBoostActive = false;
            this.nitroCooldownEndTime = now + this.nitroCooldown;
            this.nitro = 0;
        }

        // Activate boost on spacebar if not on cooldown
        if (this.keys[' '] && !this.nitroBoostActive && now >= this.nitroCooldownEndTime && this.nitro >= 100) {
            this.nitroBoostActive = true;
            this.nitroBoostEndTime = now + this.nitroBoostDuration;
            this.nitroActive = true;
            this.playSound('nitro', 0.5); // Nitro boost sound
        }

        // Apply boost effect
        if (this.nitroBoostActive) {
            this.speed = 200; // Instantly set speed to 200
            this.nitroActive = true;
            // Update nitro bar to show remaining boost time
            const remaining = (this.nitroBoostEndTime - now) / this.nitroBoostDuration;
            this.nitro = remaining * 100;
            // Create nitro trail effect
            this.createNitroTrail(car);
        } else {
            this.nitroActive = false;
            // Recharge nitro during cooldown
            if (now < this.nitroCooldownEndTime) {
                // Show cooldown progress
                const cooldownProgress = (now - (this.nitroCooldownEndTime - this.nitroCooldown)) / this.nitroCooldown;
                this.nitro = cooldownProgress * 100;
            } else {
                this.nitro = 100; // Ready to use
            }
        }

        // Steering
        const turnAmount = this.turnSpeed * (Math.abs(this.speed) / 100);
        if (this.keys['a'] || this.keys['arrowleft']) {
            car.rotation.y += turnAmount;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            car.rotation.y -= turnAmount;
        }

        // Move car
        const velocity = this.speed * 0.01;
        const newX = car.position.x + Math.sin(car.rotation.y) * velocity;
        const newZ = car.position.z + Math.cos(car.rotation.y) * velocity;

        // Store old position for collision response
        const oldX = car.position.x;
        const oldZ = car.position.z;

        car.position.x = newX;
        car.position.z = newZ;

        // Check collisions
        this.checkCarCollisions(car);
        this.checkBarrierCollision(car, oldX, oldZ);

        // Update Y position based on track height
        this.updateCarHeight(car);

        // Rotate wheels
        const wheelRotation = velocity * 2;
        car.wheels.forEach(wheel => {
            wheel.children[0].rotation.y += wheelRotation;
        });

        // Update HUD
        document.getElementById('speed').textContent = Math.abs(Math.round(this.speed));
        document.getElementById('needle').style.transform =
            `translateX(-50%) rotate(${-120 + (this.speed / this.maxSpeed) * 240}deg)`;
        document.getElementById('nitro').style.width = `${this.nitro}%`;
    }

    checkCarCollisions(car) {
        const carRadius = 2.5;
        const allCars = car.isPlayer ? this.aiCars : [this.playerCar, ...this.aiCars.filter(c => c !== car)];

        for (let i = 0; i < allCars.length; i++) {
            const other = allCars[i];
            if (other.destroyed || other === car) continue;

            const dx = car.position.x - other.position.x;
            const dz = car.position.z - other.position.z;
            const distSq = dx * dx + dz * dz;
            const minDist = carRadius * 2;

            if (distSq < minDist * minDist && distSq > 0) {
                // Collision detected - push cars apart
                const dist = Math.sqrt(distSq);
                const overlap = minDist - dist;
                const nx = dx / dist;
                const nz = dz / dist;

                // Push both cars apart
                const pushForce = overlap * 0.5;
                car.position.x += nx * pushForce;
                car.position.z += nz * pushForce;

                if (!other.isPlayer) {
                    other.position.x -= nx * pushForce;
                    other.position.z -= nz * pushForce;
                }

                // Reduce speed on collision
                if (car.isPlayer) {
                    this.speed *= 0.8;
                } else {
                    car.velocity *= 0.8;
                }

                // Check for rear collision - if car hits other's tail, car takes 3x damage
                const carSpeed = car.isPlayer ? this.speed : (car.velocity || 0);
                const otherSpeed = other.isPlayer ? this.speed : (other.velocity || 0);

                if (Math.abs(carSpeed) > 20 || Math.abs(otherSpeed) > 20) {
                    // Get car forward directions
                    const carForward = new THREE.Vector3(
                        Math.sin(car.rotation.y),
                        0,
                        Math.cos(car.rotation.y)
                    );
                    const otherForward = new THREE.Vector3(
                        Math.sin(other.rotation.y),
                        0,
                        Math.cos(other.rotation.y)
                    );

                    // Direction from car to other
                    const toOther = new THREE.Vector3(dx, 0, dz).normalize();

                    // Check if car hit other's rear (car is behind other and moving towards it)
                    const carHitOtherRear = carForward.dot(toOther) > 0.5 && otherForward.dot(toOther) > 0.3;
                    // Check if other hit car's rear
                    const otherHitCarRear = otherForward.dot(toOther.clone().negate()) > 0.5 && carForward.dot(toOther.clone().negate()) > 0.3;

                    const baseDamage = 2;

                    if (carHitOtherRear) {
                        // Car rear-ended other - car takes 10x damage (20), other takes 1x (2)
                        this.applyDamage(car, baseDamage * 10, 'collision');
                        this.applyDamage(other, baseDamage, 'collision');
                        this.playSound('hit', 0.5);
                    } else if (otherHitCarRear) {
                        // Other rear-ended car - other takes 10x damage (20), car takes 1x (2)
                        this.applyDamage(car, baseDamage, 'collision');
                        this.applyDamage(other, baseDamage * 10, 'collision');
                        this.playSound('hit', 0.5);
                    } else {
                        // Side collision - equal damage (5 each)
                        this.applyDamage(car, baseDamage * 2.5, 'collision');
                        this.applyDamage(other, baseDamage * 2.5, 'collision');
                        this.playSound('hit', 0.3);
                    }
                }
            }
        }
    }

    checkBarrierCollision(car, oldX, oldZ) {
        // Find closest track point
        let minDist = Infinity;
        let closestIdx = 0;

        for (let i = 0; i < this.trackPoints.length; i += 5) {
            const point = this.trackPoints[i];
            const dx = point.x - car.position.x;
            const dz = point.z - car.position.z;
            const dist = dx * dx + dz * dz;
            if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
            }
        }

        const trackPoint = this.trackPoints[closestIdx];
        const nextPoint = this.trackPoints[(closestIdx + 1) % this.trackPoints.length];

        // Calculate track direction and perpendicular
        const trackDirX = nextPoint.x - trackPoint.x;
        const trackDirZ = nextPoint.z - trackPoint.z;
        const trackLen = Math.sqrt(trackDirX * trackDirX + trackDirZ * trackDirZ);

        if (trackLen === 0) return;

        const perpX = -trackDirZ / trackLen;
        const perpZ = trackDirX / trackLen;

        // Distance from track center
        const toCarX = car.position.x - trackPoint.x;
        const toCarZ = car.position.z - trackPoint.z;
        const lateralDist = toCarX * perpX + toCarZ * perpZ;

        const roadWidth = 20; // Half road width (40/2)
        const barrierBounce = 0.6;

        if (Math.abs(lateralDist) > roadWidth) {
            // Hit barrier - bounce back
            const sign = lateralDist > 0 ? 1 : -1;
            const penetration = Math.abs(lateralDist) - roadWidth;

            car.position.x -= perpX * penetration * sign * 1.2;
            car.position.z -= perpZ * penetration * sign * 1.2;

            // Reduce speed and apply slight damage
            if (car.isPlayer) {
                this.speed *= barrierBounce;
                if (Math.abs(this.speed) > 20) {
                    this.applyDamage(car, 3, 'barrier');
                }
            } else if (car.velocity) {
                car.velocity *= barrierBounce;
            }
        }
    }

    updateCarHeight(car) {
        // Flat track - car stays at fixed height above road
        const roadHeight = 0.8; // Road at 0.5, car 0.3 above
        car.position.y = roadHeight;
    }

    updateAICars() {
        if (!this.gameStarted) return;

        for (let i = 0; i < this.aiCars.length; i++) {
            const car = this.aiCars[i];

            // Skip destroyed cars
            if (car.destroyed) continue;

            // Get target point on track
            const targetPoint = this.trackPoints[car.targetPoint];
            const dx = targetPoint.x - car.position.x;
            const dz = targetPoint.z - car.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            // Move to next point if close enough
            if (distance < 20) {
                car.targetPoint = (car.targetPoint + 1) % this.trackPoints.length;
            }

            // Calculate target angle
            const targetAngle = Math.atan2(dx, dz);

            // Smooth rotation towards target
            let angleDiff = targetAngle - car.rotation.y;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            car.rotation.y += angleDiff * 0.05 * car.skillLevel;

            // AI Nitro boost system
            const now = Date.now();

            // Check if boost just ended
            if (car.nitroBoostActive && now >= car.nitroBoostEndTime) {
                car.nitroBoostActive = false;
                car.nitroCooldownEndTime = now + car.nitroCooldown;
            }

            // Decide to use nitro (on straights when cooldown ready)
            const isOnStraight = Math.abs(angleDiff) < 0.1;
            if (!car.nitroBoostActive && now >= car.nitroCooldownEndTime && isOnStraight && Math.random() < 0.02) {
                car.nitroBoostActive = true;
                car.nitroBoostEndTime = now + car.nitroBoostDuration;
            }

            // Apply boost or normal speed
            if (car.nitroBoostActive) {
                car.velocity = 200; // Boost speed
                // Create nitro trail effect
                this.createNitroTrail(car);
            } else {
                // Accelerate/decelerate based on curve
                const speedFactor = 1 - Math.abs(angleDiff) * 0.3;
                car.velocity = Math.min(car.velocity + 0.3, car.maxVelocity * speedFactor);
            }

            // Store old position
            const oldX = car.position.x;
            const oldZ = car.position.z;

            // Move car
            const velocity = car.velocity * 0.01;
            car.position.x += Math.sin(car.rotation.y) * velocity;
            car.position.z += Math.cos(car.rotation.y) * velocity;

            // Check collisions for AI cars
            this.checkCarCollisions(car);
            this.checkBarrierCollision(car, oldX, oldZ);

            // Update Y position based on track height
            this.updateCarHeight(car);

            // Rotate wheels
            car.wheels.forEach(wheel => {
                wheel.children[0].rotation.y += velocity * 2;
            });
        }
    }

    updateCamera() {
        // Third person camera following player
        const car = this.playerCar;
        const cameraDistance = 15;
        const cameraHeight = 6;

        const targetX = car.position.x - Math.sin(car.rotation.y) * cameraDistance;
        const targetZ = car.position.z - Math.cos(car.rotation.y) * cameraDistance;

        this.camera.position.x += (targetX - this.camera.position.x) * 0.1;
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.1;

        // Camera follows terrain height for proper hill viewing
        const targetCamY = car.position.y + cameraHeight;
        this.camera.position.y += (targetCamY - this.camera.position.y) * 0.15;

        this.camera.lookAt(car.position.x, car.position.y + 1, car.position.z);
    }

    updatePositions() {
        // Only update positions every 10 frames for performance
        if (!this.positionUpdateCounter) this.positionUpdateCounter = 0;
        this.positionUpdateCounter++;
        if (this.positionUpdateCounter % 10 !== 0) return;

        // Calculate positions based on track progress
        const allCars = [this.playerCar, ...this.aiCars];
        const numPoints = this.trackPoints.length;

        // Sample every 5th track point instead of all
        for (let c = 0; c < allCars.length; c++) {
            const car = allCars[c];
            if (car.destroyed) continue;

            let minDist = Infinity;
            let closestPoint = car.trackProgress || 0;
            const prevProgress = car.trackProgress || 0;

            // Search for closest track point, but limit search range to prevent
            // cars behind start line from matching end-of-track points
            // Search within a reasonable range of current progress (±25% of track)
            const searchRange = Math.floor(numPoints * 0.25);
            const searchStart = Math.max(0, prevProgress - searchRange);
            const searchEnd = Math.min(numPoints, prevProgress + searchRange);

            // Also search near start/end for lap transitions
            for (let i = 0; i < numPoints; i += 5) {
                // Only search within range, OR near start (0-20%) OR near end (80-100%)
                const inRange = (i >= searchStart && i <= searchEnd);
                const nearStart = (i < numPoints * 0.2);
                const nearEnd = (i > numPoints * 0.8);
                const prevNearStart = (prevProgress < numPoints * 0.2);
                const prevNearEnd = (prevProgress > numPoints * 0.8);

                // Allow searching near start/end only if car was already near those areas
                if (!inRange && !(nearStart && prevNearStart) && !(nearEnd && prevNearEnd) && !(nearStart && prevNearEnd) && !(nearEnd && prevNearStart)) {
                    continue;
                }

                const point = this.trackPoints[i];
                const dx = point.x - car.position.x;
                const dz = point.z - car.position.z;
                const dist = dx * dx + dz * dz;
                if (dist < minDist) {
                    minDist = dist;
                    closestPoint = i;
                }
            }
            car.trackProgress = closestPoint;

            // Check for lap completion (crossed from end of track to start)
            if (prevProgress > numPoints * 0.8 && closestPoint < numPoints * 0.2) {
                car.lap = (car.lap || 1) + 1;

                // Play lap sound for player
                if (car.isPlayer) {
                    this.playSound('lap', 0.4);
                }

                // Update lap display for player
                if (car.isPlayer) {
                    document.getElementById('lap').textContent = Math.min(car.lap, 10);

                    // Create epic floating text for lap completion
                    if (car.lap <= 10) {
                        const lapText = car.lap === 10 ? 'FINAL LAP!' : 'LAP ' + car.lap + '!';
                        const lapColor = car.lap === 10 ? 0xff4400 : 0x00ffff;
                        const lapDuration = car.lap === 10 ? 4 : 3; // Final lap lasts even longer!
                        this.createFloatingText(car, lapText, lapColor, lapDuration);
                    }

                    // Check for race completion
                    if (car.lap > 10) {
                        this.finishRace(car);
                        return;
                    }
                } else {
                    // AI finished the race
                    if (car.lap > 10 && !this.raceFinished) {
                        this.finishRace(car);
                        return;
                    }
                }
            }
        }

        // Sort by total progress (lap * trackLength + trackProgress)
        // This ensures cars closest to finishing lap 10 are ranked first
        const trackLength = this.trackPoints.length;
        allCars.sort((a, b) => {
            if (a.destroyed && !b.destroyed) return 1;
            if (!a.destroyed && b.destroyed) return -1;
            const lapA = a.lap || 1;
            const lapB = b.lap || 1;
            const totalProgressA = (lapA * trackLength) + (a.trackProgress || 0);
            const totalProgressB = (lapB * trackLength) + (b.trackProgress || 0);
            return totalProgressB - totalProgressA;
        });

        this.position = allCars.indexOf(this.playerCar) + 1;

        const posEl = document.getElementById('position');
        posEl.textContent = this.position;
        posEl.nextElementSibling.textContent =
            this.position === 1 ? 'st' :
            this.position === 2 ? 'nd' :
            this.position === 3 ? 'rd' : 'th';

        // Update leaderboard
        this.updateLeaderboard(allCars);
    }

    finishRace(winner) {
        this.raceFinished = true;
        this.gameOver = true;

        const gameOverEl = document.getElementById('game-over');
        const titleEl = document.getElementById('game-over-title');
        const msgEl = document.getElementById('game-over-msg');

        if (titleEl && msgEl) {
            if (winner.isPlayer) {
                titleEl.textContent = 'YOU WIN!';
                titleEl.style.color = '#00ff00';
                titleEl.style.textShadow = '0 0 50px #00ff00, 0 0 100px #00aa00';
                msgEl.textContent = `You finished 1st place! Congratulations!`;
            } else {
                titleEl.textContent = 'RACE OVER';
                titleEl.style.color = '#ffaa00';
                titleEl.style.textShadow = '0 0 50px #ffaa00, 0 0 100px #ff6600';
                const position = this.position;
                const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
                msgEl.textContent = `${winner.name} wins! You finished ${position}${suffix} place.`;
            }
        }

        if (gameOverEl) {
            gameOverEl.classList.add('show');
        }

        // Show restart button
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.style.display = 'block';
        }
    }

    updateLeaderboard(sortedCars) {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard) return;

        // Clear old entries (keep title)
        const title = leaderboard.querySelector('.leaderboard-title');
        leaderboard.innerHTML = '';
        leaderboard.appendChild(title);

        // Add entries
        for (let i = 0; i < sortedCars.length; i++) {
            const car = sortedCars[i];
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';

            if (car.isPlayer) entry.classList.add('player');
            if (car.destroyed) entry.classList.add('eliminated');

            const healthPercent = Math.max(0, (car.health / car.maxHealth) * 100);

            entry.innerHTML = `
                <span class="leaderboard-pos">${i + 1}.</span>
                <span class="leaderboard-name">${car.name}</span>
                <div class="leaderboard-health">
                    <div class="leaderboard-health-fill" style="width: ${healthPercent}%"></div>
                </div>
            `;

            leaderboard.appendChild(entry);
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.updateCulling(); // Cull first so updates can skip invisible objects
        this.updatePlayerCar();
        this.updateAICars();
        this.updateHelicopters();
        this.updateMissiles();
        this.updateExplosions();
        this.updateNitroTrails();
        this.updateGhosts();
        this.updatePickups();
        this.updateCarShields();
        this.updateInvincibilityUI();
        this.updateEngineSound();
        this.updateCamera();
        this.updatePositions();

        this.renderer.render(this.scene, this.camera);
    }

    updateCulling() {
        const camX = this.camera.position.x;
        const camZ = this.camera.position.z;
        const viewDistSq = this.viewDistanceSq;
        const buildingDistSq = this.buildingViewDistSq;

        // Fast squared distance culling for road segments
        for (let i = 0; i < this.roadSegments.length; i++) {
            const seg = this.roadSegments[i];
            const dx = seg.position.x - camX;
            const dz = seg.position.z - camZ;
            seg.visible = (dx * dx + dz * dz) < viewDistSq;
        }

        // Buildings use larger view distance (city skyline always visible)
        for (let i = 0; i < this.buildings.length; i++) {
            const building = this.buildings[i];
            const dx = building.position.x - camX;
            const dz = building.position.z - camZ;
            building.visible = (dx * dx + dz * dz) < buildingDistSq;
        }

        // Cull general cullable objects (street lights, etc)
        for (let i = 0; i < this.cullableObjects.length; i++) {
            const obj = this.cullableObjects[i];
            if (!obj) continue;
            const dx = obj.position.x - camX;
            const dz = obj.position.z - camZ;
            const distSq = dx * dx + dz * dz;

            if (distSq > viewDistSq) {
                obj.visible = false;
            } else {
                obj.visible = true;
                // Disable lights on distant objects
                if (obj.children && distSq > 8000) { // ~90 units
                    for (let j = 0; j < obj.children.length; j++) {
                        if (obj.children[j].isLight) {
                            obj.children[j].visible = false;
                        }
                    }
                }
            }
        }

        // Cull ghosts
        for (let i = 0; i < this.ghosts.length; i++) {
            const ghost = this.ghosts[i];
            if (ghost.collected) continue;
            const dx = ghost.position.x - camX;
            const dz = ghost.position.z - camZ;
            ghost.visible = (dx * dx + dz * dz) < viewDistSq;
        }

        // Cull helicopters (they're usually visible but still check)
        for (let i = 0; i < this.helicopters.length; i++) {
            const heli = this.helicopters[i];
            const dx = heli.position.x - camX;
            const dz = heli.position.z - camZ;
            heli.visible = (dx * dx + dz * dz) < 40000; // Larger view distance for helis
        }

        // Cull missiles
        for (let i = 0; i < this.missiles.length; i++) {
            const missile = this.missiles[i];
            const dx = missile.position.x - camX;
            const dz = missile.position.z - camZ;
            missile.visible = (dx * dx + dz * dz) < viewDistSq;
        }

        // Cull explosions
        for (let i = 0; i < this.explosions.length; i++) {
            const exp = this.explosions[i];
            const dx = exp.position.x - camX;
            const dz = exp.position.z - camZ;
            exp.visible = (dx * dx + dz * dz) < viewDistSq;
        }
    }

    registerCullable(obj) {
        this.cullableObjects.push(obj);
    }
}

// Start the game
window.addEventListener('load', () => {
    new RacingGame();
});
