/**
 * GMX TUNNEL — CÓPIA FIEL DO APP.JS ORIGINAL
 * Adaptado para funcionar com THREE.js CDN
 */

(function() {
    'use strict';
    
    console.log('GMX Tunnel: Script carregado');

    // ─── BASE PATH (para funcionar de /en/ também) ─────────
    var _basePath = window.location.pathname.indexOf('/en/') !== -1 ? '../' : '';

    // ─── DETECÇÃO ──────────────────────────────────────────
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    const isLowEnd = isMobile && (navigator.hardwareConcurrency <= 4);

    // ─── CONFIG — IDÊNTICO AO ORIGINAL ─────────────────────
    const blockCount = isMobile ? (isLowEnd ? 500 : 900) : 3500;
    const profundidade = isMobile ? 250 : 350;

    // ─── PALETA — EXATAMENTE DO ORIGINAL ───────────────────
    const PALETTE = {
        bg: 0x020204,
        // Chromes — metal polido
        chrome: 0x8090a0,
        chromeDark: 0x506070,
        chromeBright: 0xa0b0c0,
        // Cyan
        cyan: 0x00f0ff,
        cyanBright: 0x40ffff,
        cyanMid: 0x00c8e0,
        // Magenta
        magenta: 0xff00ff,
        magentaPink: 0xff40c0,
        magentaDeep: 0xc020a0,
        // Acento
        purple: 0x8020ff,
    };

    // ─── STATE ─────────────────────────────────────────────
    let container, containerRect;
    let scene, camera, renderer;
    let animationId = null;
    let isVisible = false;

    let targetZ = 5;
    let mouseX = 0, mouseY = 0;
    let touchStartY = 0;

    let logoMesh = null;
    let logoGlow = null;
    let logoZ = 0;

    let keyLight = null;
    let cyanLights = [];
    let magentaLights = [];
    let emissiveInstances = [];
    let clock = null;

    // Mobile fullscreen state
    let mobileOverlay = null;
    let mobileReady = false;

    // ─── INIT ──────────────────────────────────────────────
    function init() {
        console.log('GMX Tunnel: init() chamado');
        
        document.body.classList.remove('about-cube-disabled');
        document.body.classList.add('tunel-gmx-active');
        
        container = document.getElementById('cube-container');
        if (!container) {
            console.warn('GMX Tunnel: cube-container não encontrado');
            return;
        }

        // ─── MOBILE: defer preload until user scrolls near ──
        if (isMobile) {
            setupMobileLazyInit();
            return;
        }

        // ─── DESKTOP: normal inline init ──────────────────
        containerRect = container.getBoundingClientRect();
        console.log('GMX Tunnel: container rect:', containerRect.width, 'x', containerRect.height);
        
        if (containerRect.width < 10 || containerRect.height < 10) {
            setTimeout(init, 200);
            return;
        }

        while (container.firstChild) container.removeChild(container.firstChild);

        setupRenderer();
        setupScene();
        setupCamera();
        setupLights();
        loadTunnel();
        setupInteraction();
        setupVisibility();

        console.log('GMX Tunnel: Inicializado!');
    }

    // ─── MOBILE: lazy init — only preload when near the section ─────
    function setupMobileLazyInit() {
        console.log('GMX Tunnel: Mobile — waiting for scroll near About section');

        // Add "TAP TO ENTER" hint immediately (lightweight)
        var aboutLeft = container.parentElement;
        if (aboutLeft && aboutLeft.classList.contains('about-left')) {
            var tapHint = document.createElement('div');
            tapHint.className = 'tunnel-tap-hint';
            tapHint.innerHTML = '<div class="tap-hint-icon">▶</div><span>' + (window.__GMX_LANG === 'en' ? 'TAP TO EXPLORE' : 'TOQUE PARA EXPLORAR') + '</span>';
            aboutLeft.appendChild(tapHint);

            // Show loading state while building
            var loadingLabel = document.createElement('div');
            loadingLabel.className = 'tunnel-loading-label';
            loadingLabel.textContent = window.__GMX_LANG === 'en' ? 'LOADING...' : 'CARREGANDO...';
            loadingLabel.style.cssText = 'display:none;position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-family:Syncopate,sans-serif;font-size:0.55rem;letter-spacing:3px;color:rgba(0,242,254,0.5);z-index:21;';
            aboutLeft.appendChild(loadingLabel);

            // Tap/click handler directly on the tap hint for reliability
            var pendingOpen = false;
            function handleTunnelTap(e) {
                e.stopPropagation();
                e.preventDefault();
                console.log('GMX Tunnel: Tap detected, mobileReady=' + mobileReady);
                if (mobileReady) {
                    openMobileTunnel();
                } else {
                    // Not ready yet — show loading feedback and open when ready
                    pendingOpen = true;
                    tapHint.querySelector('span').textContent = window.__GMX_LANG === 'en' ? 'LOADING...' : 'CARREGANDO...';
                    tapHint.style.opacity = '0.6';
                }
            }
            tapHint.addEventListener('touchend', handleTunnelTap, { passive: false });
            tapHint.addEventListener('click', handleTunnelTap);

            // Store pendingOpen checker on window for initMobile to use
            window._gmxTunnelPendingOpen = function() {
                if (pendingOpen) {
                    pendingOpen = false;
                    tapHint.querySelector('span').textContent = window.__GMX_LANG === 'en' ? 'TAP TO EXPLORE' : 'TOQUE PARA EXPLORAR';
                    tapHint.style.opacity = '1';
                    openMobileTunnel();
                }
            };
        }

        // Use IntersectionObserver to detect when the About section is 
        // ~1 screen away, then start building the tunnel in background
        var aboutSection = document.querySelector('.about-gmx') || aboutLeft;
        if (aboutSection) {
            var lazyObs = new IntersectionObserver(function(entries) {
                if (entries[0].isIntersecting) {
                    lazyObs.disconnect();
                    console.log('GMX Tunnel: About section approaching — starting mobile preload');
                    // Show loading indicator
                    var ll = document.querySelector('.tunnel-loading-label');
                    if (ll) ll.style.display = 'block';
                    // Use requestIdleCallback or setTimeout to avoid blocking scroll
                    var startBuild = function() { initMobile(); };
                    if (window.requestIdleCallback) {
                        window.requestIdleCallback(startBuild, { timeout: 500 });
                    } else {
                        setTimeout(startBuild, 100);
                    }
                }
            }, { rootMargin: '600px 0px' }); // Start loading 600px before visible
            lazyObs.observe(aboutSection);
        } else {
            // Fallback: load after 3s
            setTimeout(initMobile, 3000);
        }
    }

    // ─── MOBILE INIT ───────────────────────────────────────
    function initMobile() {
        if (mobileReady) return; // Already loaded
        console.log('GMX Tunnel: Mobile mode — preloading hidden');

        // Create fullscreen overlay
        mobileOverlay = document.createElement('div');
        mobileOverlay.id = 'tunnel-mobile-overlay';
        mobileOverlay.innerHTML = '<button class="tunnel-mobile-close" aria-label="Fechar túnel">✕</button>';
        mobileOverlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:#000;display:none;opacity:0;transition:opacity 0.4s ease;';
        document.body.appendChild(mobileOverlay);

        // Close button handler
        var closeBtn = mobileOverlay.querySelector('.tunnel-mobile-close');
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeMobileTunnel();
        });

        // Use the overlay as the render target container
        container = mobileOverlay;
        containerRect = { width: window.innerWidth, height: window.innerHeight };

        while (container.children.length > 1) {
            if (container.lastChild !== closeBtn) container.removeChild(container.lastChild);
            else break;
        }

        setupRenderer();
        setupScene();
        setupCamera();
        setupLights();
        loadTunnel();

        mobileReady = true;

        // Hide loading indicator, update hint
        var ll = document.querySelector('.tunnel-loading-label');
        if (ll) ll.style.display = 'none';

        console.log('GMX Tunnel: Mobile preloaded — ready for tap');

        // If user tapped before ready, open now
        if (window._gmxTunnelPendingOpen) window._gmxTunnelPendingOpen();
    }

    function openMobileTunnel() {
        if (!mobileOverlay || !renderer) return;
        console.log('GMX Tunnel: Opening fullscreen mobile');

        // Reset camera to start
        targetZ = 5;
        camera.position.set(0, 0, 5);

        // Resize to fullscreen
        var w = window.innerWidth;
        var h = window.innerHeight;
        containerRect = { width: w, height: h, left: 0, top: 0, right: w, bottom: h };
        camera.aspect = w / h;
        camera.fov = h > w ? 85 : 72;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);

        // Show overlay
        mobileOverlay.style.display = 'block';
        requestAnimationFrame(function() { mobileOverlay.style.opacity = '1'; });

        // Lock page scroll
        document.body.style.overflow = 'hidden';
        if (window.lenis) window.lenis.stop();

        // Setup touch interaction on the overlay
        setupMobileTouch();

        // Start animation
        isVisible = true;
        startAnimation();
    }

    function closeMobileTunnel() {
        if (!mobileOverlay) return;
        console.log('GMX Tunnel: Closing fullscreen mobile');

        mobileOverlay.style.opacity = '0';
        setTimeout(function() {
            mobileOverlay.style.display = 'none';
        }, 400);

        // Restore page scroll
        document.body.style.overflow = '';
        if (window.lenis) window.lenis.start();

        // Stop animation
        isVisible = false;
        stopAnimation();
    }

    function setupMobileTouch() {
        // Remove old listeners by replacing node (simple approach)
        // Touch listeners are on mobileOverlay directly
        mobileOverlay.ontouchstart = function(e) {
            if (e.target.classList.contains('tunnel-mobile-close')) return;
            touchStartY = e.touches[0].clientY;
        };

        mobileOverlay.ontouchmove = function(e) {
            e.preventDefault();
            var delta = touchStartY - e.touches[0].clientY;
            targetZ -= delta * 0.15;
            targetZ = Math.max(-profundidade + 20, Math.min(5, targetZ));
            touchStartY = e.touches[0].clientY;
        };
    }

    // ─── RENDERER ──────────────────────────────────────────
    function setupRenderer() {
        renderer = new THREE.WebGLRenderer({ 
            antialias: !isMobile,
            alpha: false,
            powerPreference: 'high-performance',
        });
        
        renderer.setSize(containerRect.width, containerRect.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.65;  // Mais escuro
        renderer.outputEncoding = THREE.sRGBEncoding;
        
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
        container.appendChild(renderer.domElement);
    }

    // ─── SCENE ─────────────────────────────────────────────
    function setupScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);  // PRETO PURO
        scene.fog = new THREE.FogExp2(0x000005, 0.008);  // Fog mais sutil
        
        // ═══ ENV-MAP PROCEDURAL — SEGREDO DOS REFLEXOS ═══
        // Cria uma cena com painéis coloridos que são refletidos nos metais
        createEnvironmentMap();
    }
    
    // ─── ENV-MAP — MAIS BRILHANTE PARA REFLEXOS FORTES ─────
    function createEnvironmentMap() {
        var pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        
        var envScene = new THREE.Scene();
        
        // Esfera de fundo PRETA
        var envGeo = new THREE.SphereGeometry(50, 32, 32);
        var envMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide,
        });
        envScene.add(new THREE.Mesh(envGeo, envMat));
        
        // Painéis GRANDES e BRILHANTES para reflexos fortes
        var panelGeo = new THREE.PlaneGeometry(60, 60);
        
        // CYAN - painéis grandes
        var panelMatCyan = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            side: THREE.DoubleSide 
        });
        
        // Cyan - topo
        var panelCyan1 = new THREE.Mesh(panelGeo, panelMatCyan);
        panelCyan1.position.set(0, 30, -25);
        panelCyan1.rotation.x = Math.PI / 2;
        envScene.add(panelCyan1);
        
        // Cyan - esquerda
        var panelCyan2 = new THREE.Mesh(panelGeo, panelMatCyan);
        panelCyan2.position.set(-30, 0, -15);
        panelCyan2.rotation.y = Math.PI / 2;
        envScene.add(panelCyan2);
        
        // MAGENTA - painéis grandes
        var panelMatMag = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff, 
            side: THREE.DoubleSide 
        });
        
        // Magenta - base
        var panelMag1 = new THREE.Mesh(panelGeo, panelMatMag);
        panelMag1.position.set(0, -30, -25);
        panelMag1.rotation.x = Math.PI / 2;
        envScene.add(panelMag1);
        
        // Magenta - direita
        var panelMag2 = new THREE.Mesh(panelGeo, panelMatMag);
        panelMag2.position.set(30, 0, -15);
        panelMag2.rotation.y = Math.PI / 2;
        envScene.add(panelMag2);
        
        // PURPLE/BLUE - fundo
        var panelMatPurp = new THREE.MeshBasicMaterial({ 
            color: 0x4400ff, 
            side: THREE.DoubleSide 
        });
        var panelPurp = new THREE.Mesh(panelGeo, panelMatPurp);
        panelPurp.position.set(0, 0, -40);
        envScene.add(panelPurp);
        
        // Luzes fortes no env
        var cyanEnv = new THREE.PointLight(0x00ffff, 15, 150);
        cyanEnv.position.set(15, 12, -20);
        envScene.add(cyanEnv);
        
        var magentaEnv = new THREE.PointLight(0xff00ff, 12, 150);
        magentaEnv.position.set(-15, -12, -20);
        envScene.add(magentaEnv);
        
        // Gerar env-map e aplicar
        var envRT = pmremGenerator.fromScene(envScene, 0.04);
        scene.environment = envRT.texture;
        
        console.log('GMX Tunnel: Environment map criado!');
    }

    // ─── CAMERA ────────────────────────────────────────────
    function setupCamera() {
        const aspect = containerRect.width / containerRect.height;
        const fov = isMobile && containerRect.height > containerRect.width ? 85 : 72;
        camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        camera.position.set(0, 0, 5);
    }

    // ─── LIGHTS — ESCURAS COMO ORIGINAL ─────────────────────
    function setupLights() {
        // Ambient muito baixo
        scene.add(new THREE.AmbientLight(0x040408, 0.08));
        
        // Hemisphere sutil
        scene.add(new THREE.HemisphereLight(PALETTE.cyanMid, PALETTE.magentaDeep, 0.06));
        
        // Key light - fraca
        keyLight = new THREE.PointLight(0xffffff, 2, 30, 2);
        keyLight.position.set(0, 2, 5);
        scene.add(keyLight);

        // Cyan point lights - menos intensas
        var cyanCount = isMobile ? 6 : 10;
        for (var i = 0; i < cyanCount; i++) {
            var light = new THREE.PointLight(PALETTE.cyan, 3, 45, 2);
            var spacing = isMobile ? 45 : 35;
            light.position.set(
                (i % 2 === 0 ? -10 : 10),
                (i % 3 === 0 ? 7 : -7),
                -i * spacing
            );
            scene.add(light);
            cyanLights.push(light);
        }

        // Magenta point lights - menos intensas
        var magentaCount = isMobile ? 6 : 10;
        for (var i = 0; i < magentaCount; i++) {
            var light = new THREE.PointLight(PALETTE.magenta, 2.5, 45, 2);
            var spacing = isMobile ? 45 : 35;
            light.position.set(
                (i % 2 === 0 ? 9 : -9),
                (i % 3 === 0 ? -6 : 6),
                -i * spacing - 15
            );
            scene.add(light);
            magentaLights.push(light);
        }
    }

    // ─── MATERIAIS — BLOCOS PRETOS COM REFLEXOS ───────────
    function createMaterials() {
        // CROMO PRETO — blocos são PRETOS, só mostram reflexos
        var matChrome = new THREE.MeshPhysicalMaterial({
            color: 0x080810,       // PRETO
            roughness: 0.15,
            metalness: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            reflectivity: 1.0,
            envMapIntensity: 2.0,
        });

        // Cromo preto profundo
        var matChromeDark = new THREE.MeshPhysicalMaterial({
            color: 0x040408,
            roughness: 0.25,
            metalness: 1.0,
            clearcoat: 0.6,
            clearcoatRoughness: 0.10,
            reflectivity: 0.9,
            envMapIntensity: 1.5,
        });

        // Cromo preto menos intenso
        var matChromeBright = new THREE.MeshPhysicalMaterial({
            color: 0x0c0c14,
            roughness: 0.10,
            metalness: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            reflectivity: 1.0,
            envMapIntensity: 2.5,
        });

        // CYAN emissivo - mais sutil
        var matCyan = new THREE.MeshPhysicalMaterial({
            color: 0x004048,
            emissive: PALETTE.cyan,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.5,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
        });

        // Cyan bright
        var matCyanBright = new THREE.MeshPhysicalMaterial({
            color: 0x005058,
            emissive: PALETTE.cyanBright,
            emissiveIntensity: 0.4,
            roughness: 0.25,
            metalness: 0.4,
            clearcoat: 0.6,
            clearcoatRoughness: 0.08,
        });

        // Cyan mid
        var matCyanMid = new THREE.MeshPhysicalMaterial({
            color: 0x003038,
            emissive: PALETTE.cyanMid,
            emissiveIntensity: 0.2,
            roughness: 0.35,
            metalness: 0.5,
            clearcoat: 0.4,
            clearcoatRoughness: 0.12,
        });

        // MAGENTA - mais sutil
        var matMagenta = new THREE.MeshPhysicalMaterial({
            color: 0x400040,
            emissive: PALETTE.magenta,
            emissiveIntensity: 0.25,
            roughness: 0.3,
            metalness: 0.5,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
        });

        // Hot pink
        var matMagentaPink = new THREE.MeshPhysicalMaterial({
            color: 0x401030,
            emissive: PALETTE.magentaPink,
            emissiveIntensity: 0.35,
            roughness: 0.25,
            metalness: 0.4,
            clearcoat: 0.6,
            clearcoatRoughness: 0.08,
        });

        // Magenta deep
        var matMagentaDeep = new THREE.MeshPhysicalMaterial({
            color: 0x300028,
            emissive: PALETTE.magentaDeep,
            emissiveIntensity: 0.18,
            roughness: 0.35,
            metalness: 0.5,
            clearcoat: 0.4,
            clearcoatRoughness: 0.12,
        });

        // Purple
        var matPurple = new THREE.MeshPhysicalMaterial({
            color: 0x200040,
            emissive: PALETTE.purple,
            emissiveIntensity: 0.2,
            roughness: 0.3,
            metalness: 0.5,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
        });

        // PESOS EXATAMENTE DO ORIGINAL
        return [
            { mat: matChrome, weight: 40 },
            { mat: matChromeDark, weight: 30 },
            { mat: matChromeBright, weight: 15 },
            { mat: matCyan, weight: 4 },
            { mat: matCyanMid, weight: 2 },
            { mat: matMagenta, weight: 3 },
            { mat: matMagentaDeep, weight: 2 },
            { mat: matPurple, weight: 2 },
            { mat: matCyanBright, weight: 1 },
            { mat: matMagentaPink, weight: 1 },
        ];
    }

    function pickMaterial(materials, totalWeight) {
        var r = Math.random() * totalWeight;
        for (var i = 0; i < materials.length; i++) {
            r -= materials[i].weight;
            if (r <= 0) return materials[i];
        }
        return materials[0];
    }

    // ─── TÚNEL ─────────────────────────────────────────────
    // Lazy-load GLTFLoader + DRACOLoader on mobile (not in HTML)
    function ensureLoaders(callback) {
        var GLTFLoaderClass = THREE.GLTFLoader || window.GLTFLoader;
        if (GLTFLoaderClass) { callback(); return; }
        // Mobile: scripts weren't loaded in HTML, load them now
        console.log('GMX Tunnel: Lazy-loading GLTFLoader + DRACOLoader');
        var loaded = 0;
        var urls = [
            'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js',
            'https://unpkg.com/three@0.128.0/examples/js/loaders/DRACOLoader.js'
        ];
        urls.forEach(function(url) {
            var s = document.createElement('script');
            s.src = url;
            s.onload = s.onerror = function() {
                loaded++;
                if (loaded >= urls.length) callback();
            };
            document.head.appendChild(s);
        });
    }

    function loadTunnel() {
        console.log('GMX Tunnel: Carregando túnel...');
        ensureLoaders(function() { _loadTunnelModel(); });
    }

    function _loadTunnelModel() {
        var GLTFLoaderClass = THREE.GLTFLoader || window.GLTFLoader;
        if (!GLTFLoaderClass) {
            console.warn('GMX Tunnel: GLTFLoader não disponível');
            buildTunnel(new THREE.BoxGeometry(1, 1, 1));
            return;
        }
        
        var loader = new GLTFLoaderClass();
        
        var DRACOLoaderClass = THREE.DRACOLoader || window.DRACOLoader;
        if (DRACOLoaderClass) {
            var dracoLoader = new DRACOLoaderClass();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(dracoLoader);
        }

        loader.load(_basePath + 'assets/tunel.glb', function(gltf) {
            console.log('GMX Tunnel: tunel.glb carregado!');
            var geometry = null;
            gltf.scene.traverse(function(child) {
                if (child.isMesh && !geometry) {
                    geometry = child.geometry;
                }
            });

            if (!geometry) {
                geometry = new THREE.BoxGeometry(1, 1, 1);
            }

            geometry.computeBoundingBox();
            geometry.center();
            buildTunnel(geometry);
        }, undefined, function(error) {
            console.error('GMX Tunnel: Erro:', error);
            buildTunnel(new THREE.BoxGeometry(1, 1, 1));
        });
    }

    function buildTunnel(geometry) {
        console.log('GMX Tunnel: Construindo túnel com', blockCount, 'blocos');
        
        var materials = createMaterials();
        var totalWeight = 0;
        for (var i = 0; i < materials.length; i++) {
            totalWeight += materials[i].weight;
        }

        logoZ = -profundidade + 5;

        // ── GRID: EXATAMENTE DO ORIGINAL ──
        var cellX = 2.2;
        var cellY = 2.2;
        var cellZ = 3.5;
        var gap = 0.15;
        var tunnelHalfW = 10;
        var tunnelHalfH = 7;
        var tunnelDepth = profundidade;

        var positions = [];
        var zSlices = Math.floor(tunnelDepth / cellZ);
        var xSlots = Math.floor((tunnelHalfW * 2) / cellX);
        var ySlots = Math.floor((tunnelHalfH * 2) / cellY);

        // Chão (2 camadas)
        for (var layer = 0; layer < 2; layer++) {
            for (var xi = 0; xi < xSlots; xi++) {
                for (var zi = 0; zi < zSlices; zi++) {
                    positions.push({
                        x: -tunnelHalfW + xi * cellX + cellX * 0.5,
                        y: -tunnelHalfH - layer * cellY - cellY * 0.5,
                        z: -zi * cellZ,
                    });
                }
            }
        }

        // Teto (2 camadas)
        for (var layer = 0; layer < 2; layer++) {
            for (var xi = 0; xi < xSlots; xi++) {
                for (var zi = 0; zi < zSlices; zi++) {
                    positions.push({
                        x: -tunnelHalfW + xi * cellX + cellX * 0.5,
                        y: tunnelHalfH + layer * cellY + cellY * 0.5,
                        z: -zi * cellZ,
                    });
                }
            }
        }

        // Parede esquerda (2 camadas)
        for (var layer = 0; layer < 2; layer++) {
            for (var yi = 0; yi < ySlots; yi++) {
                for (var zi = 0; zi < zSlices; zi++) {
                    positions.push({
                        x: -tunnelHalfW - layer * cellX - cellX * 0.5,
                        y: -tunnelHalfH + yi * cellY + cellY * 0.5,
                        z: -zi * cellZ,
                    });
                }
            }
        }

        // Parede direita (2 camadas)
        for (var layer = 0; layer < 2; layer++) {
            for (var yi = 0; yi < ySlots; yi++) {
                for (var zi = 0; zi < zSlices; zi++) {
                    positions.push({
                        x: tunnelHalfW + layer * cellX + cellX * 0.5,
                        y: -tunnelHalfH + yi * cellY + cellY * 0.5,
                        z: -zi * cellZ,
                    });
                }
            }
        }

        // Embaralhar
        for (var i = positions.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = positions[i];
            positions[i] = positions[j];
            positions[j] = temp;
        }

        // USAR TODAS AS POSIÇÕES - sem buracos!
        // Otimizado para performance
        var maxBlocks = isMobile ? 1500 : 3500;
        var finalPositions = positions.slice(0, Math.min(positions.length, maxBlocks));
        console.log('GMX Tunnel: Total posições:', finalPositions.length);

        // Agrupar por material
        var matGroups = new Map();
        for (var i = 0; i < finalPositions.length; i++) {
            var pos = finalPositions[i];
            var entry = pickMaterial(materials, totalWeight);
            if (!matGroups.has(entry.mat)) matGroups.set(entry.mat, []);
            matGroups.get(entry.mat).push(pos);
        }

        var dummy = new THREE.Object3D();

        // Criar InstancedMesh por material
        matGroups.forEach(function(posList, mat) {
            var inst = new THREE.InstancedMesh(geometry, mat, posList.length);

            for (var i = 0; i < posList.length; i++) {
                var pos = posList[i];
                var maxScale = cellX - gap;
                var scaleX = maxScale * (0.7 + Math.random() * 0.3);
                var scaleY = maxScale * (0.7 + Math.random() * 0.3);
                var scaleZ = cellZ * (0.6 + Math.random() * 0.4);

                dummy.position.set(
                    pos.x + (Math.random() - 0.5) * gap * 2,
                    pos.y + (Math.random() - 0.5) * gap * 2,
                    pos.z + (Math.random() - 0.5) * gap * 2
                );
                dummy.scale.set(scaleX, scaleY, scaleZ);
                dummy.rotation.set(
                    (Math.random() - 0.5) * 0.06,
                    (Math.random() - 0.5) * 0.06,
                    (Math.random() - 0.5) * 0.03
                );
                dummy.updateMatrix();
                inst.setMatrixAt(i, dummy.matrix);
            }

            inst.instanceMatrix.needsUpdate = true;
            scene.add(inst);

            // Track emissivos
            if (mat.emissive && mat.emissiveIntensity > 0) {
                emissiveInstances.push({ inst: inst, mat: mat, baseIntensity: mat.emissiveIntensity });
            }
        });

        console.log('GMX Tunnel:', finalPositions.length, 'blocos criados');
        
        loadLogo();
        renderer.render(scene, camera);

        // On mobile, capture a preview thumbnail for the about-left card
        if (isMobile && renderer && renderer.domElement) {
            try {
                var previewURL = renderer.domElement.toDataURL('image/jpeg', 0.6);
                var cubeContainer = document.getElementById('cube-container');
                if (cubeContainer) {
                    cubeContainer.style.backgroundImage = 'url(' + previewURL + ')';
                    cubeContainer.style.backgroundSize = 'cover';
                    cubeContainer.style.backgroundPosition = 'center';
                }
                console.log('GMX Tunnel: Mobile preview thumbnail set');
            } catch(e) { console.warn('GMX Tunnel: Could not capture preview', e); }
        }
    }

    // ─── LOGO ──────────────────────────────────────────────
    function loadLogo() {
        var textureLoader = new THREE.TextureLoader();
        textureLoader.load(_basePath + 'assets/logo-gmx.png', function(texture) {
            texture.encoding = THREE.sRGBEncoding;
            
            var aspect = texture.image.width / texture.image.height;
            var logoHeight = 9;
            var logoWidth = logoHeight * aspect;

            var logoMat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });

            var logoGeo = new THREE.PlaneGeometry(logoWidth, logoHeight);
            logoMesh = new THREE.Mesh(logoGeo, logoMat);
            logoMesh.position.set(0, 0, logoZ);
            scene.add(logoMesh);

            var glowMat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                color: PALETTE.cyan,
            });

            logoGlow = new THREE.Mesh(
                new THREE.PlaneGeometry(logoWidth * 1.15, logoHeight * 1.15),
                glowMat
            );
            logoGlow.position.set(0, 0, logoZ - 0.5);
            scene.add(logoGlow);

            var logoLight = new THREE.PointLight(PALETTE.cyan, 0, 25, 2);
            logoLight.position.set(0, 0, logoZ + 2);
            scene.add(logoLight);
            logoMesh.userData.light = logoLight;
        });
    }

    // ─── INTERAÇÃO ─────────────────────────────────────────
    let mouseOverTunnel = false;

    function isOverContainer(e) {
        if (!container) return false;
        var rect = container.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    }

    function setupInteraction() {
        // Hitbox is the .about-left parent (larger visible area)
        var hitbox = container.parentElement || container;

        hitbox.addEventListener('mouseenter', function() {
            mouseOverTunnel = true;
            if (window.lenis) window.lenis.stop();
            container.style.cursor = 'grab';
        });

        hitbox.addEventListener('mouseleave', function() {
            mouseOverTunnel = false;
            if (window.lenis) window.lenis.start();
            container.style.cursor = 'default';
        });

        container.addEventListener('mousemove', function(e) {
            var rect = container.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        }, { passive: true });

        // DOCUMENT-LEVEL capture handler — intercepts wheel BEFORE Lenis or anything else
        document.addEventListener('wheel', function(e) {
            if (!mouseOverTunnel && !isOverContainer(e)) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            targetZ -= e.deltaY * 0.06;
            targetZ = Math.max(-profundidade + 20, Math.min(5, targetZ));
            console.log('[GMX Tunnel] wheel captured, targetZ:', targetZ.toFixed(1));
        }, { passive: false, capture: true });

        container.addEventListener('touchstart', function(e) {
            touchStartY = e.touches[0].clientY;
            mouseOverTunnel = true;
            if (window.lenis) window.lenis.stop();
        }, { passive: true });

        container.addEventListener('touchmove', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            var delta = touchStartY - e.touches[0].clientY;
            targetZ -= delta * 0.12;
            targetZ = Math.max(-profundidade + 20, Math.min(5, targetZ));
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        container.addEventListener('touchend', function() {
            mouseOverTunnel = false;
            if (window.lenis) window.lenis.start();
        }, { passive: true });

        window.addEventListener('resize', onResize, { passive: true });
    }

    function onResize() {
        if (!container || !camera || !renderer) return;
        
        if (isMobile && mobileOverlay) {
            // Mobile fullscreen — use window size
            var w = window.innerWidth;
            var h = window.innerHeight;
            containerRect = { width: w, height: h, left: 0, top: 0, right: w, bottom: h };
            camera.aspect = w / h;
            camera.fov = h > w ? 85 : 72;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            return;
        }

        containerRect = container.getBoundingClientRect();
        var w = containerRect.width;
        var h = containerRect.height;

        camera.aspect = w / h;
        camera.fov = (isMobile && h > w) ? 85 : 72;
        camera.updateProjectionMatrix();

        renderer.setSize(w, h);
    }

    // ─── VISIBILITY ────────────────────────────────────────
    function setupVisibility() {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && !isVisible) {
                    isVisible = true;
                    startAnimation();
                } else if (!entry.isIntersecting && isVisible) {
                    isVisible = false;
                    stopAnimation();
                }
            });
        }, { rootMargin: '200px 0px', threshold: 0 });

        observer.observe(container);
    }

    function startAnimation() {
        if (animationId) return;
        clock = new THREE.Clock();
        animate();
    }

    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // ─── ANIMATION LOOP ────────────────────────────────────
    function animate() {
        if (!isVisible) return;
        animationId = requestAnimationFrame(animate);

        var elapsed = clock.getElapsedTime();

        // Camera
        camera.position.z += (targetZ - camera.position.z) * 0.065;
        camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.04;
        camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.04;

        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, -mouseX * 0.03, 0.05);
        camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, mouseY * 0.02, 0.05);

        // Key light segue câmera
        if (keyLight) {
            keyLight.position.z = camera.position.z - 3;
            keyLight.position.x = camera.position.x;
        }

        // Pulsação emissivos
        for (var i = 0; i < emissiveInstances.length; i++) {
            var e = emissiveInstances[i];
            var phase = elapsed * 0.5 + i * 1.2;
            e.mat.emissiveIntensity = e.baseIntensity + Math.sin(phase) * 0.08;
        }

        // Pulsação luzes - valores baixos
        for (var i = 0; i < cyanLights.length; i++) {
            cyanLights[i].intensity = 3 + Math.sin(elapsed * 0.6 + i * 0.7) * 0.5;
        }
        for (var i = 0; i < magentaLights.length; i++) {
            magentaLights[i].intensity = 2.5 + Math.sin(elapsed * 0.5 + i * 0.9) * 0.4;
        }

        // Logo reveal
        if (logoMesh && logoZ !== 0) {
            var distToLogo = camera.position.z - logoZ;
            var revealStart = 60;
            var revealEnd = 15;
            var t = THREE.MathUtils.clamp(
                1 - (distToLogo - revealEnd) / (revealStart - revealEnd),
                0, 1
            );
            var ease = 1 - Math.pow(1 - t, 3);

            logoMesh.material.opacity = ease * 0.9;
            if (logoGlow) logoGlow.material.opacity = ease * 0.25;

            var scale = 0.7 + ease * 0.3;
            logoMesh.scale.set(scale, scale, 1);
            if (logoGlow) logoGlow.scale.set(scale * 1.15, scale * 1.15, 1);

            if (logoMesh.userData.light) {
                logoMesh.userData.light.intensity = ease * 6;
            }

            logoMesh.position.y = Math.sin(elapsed * 0.8) * 0.15;
            if (logoGlow) logoGlow.position.y = logoMesh.position.y;
        }

        renderer.render(scene, camera);
    }

    // ─── ESPERAR THREE.js ───────────────────────────────────
    function waitForThree() {
        if (typeof THREE === 'undefined') {
            setTimeout(waitForThree, 100);
            return;
        }
        console.log('GMX Tunnel: THREE.js detectado');
        waitForContainer();
    }
    
    function waitForContainer() {
        var c = document.getElementById('cube-container');
        if (c) {
            console.log('GMX Tunnel: cube-container encontrado');
            setTimeout(init, 100);
        } else {
            setTimeout(waitForContainer, 200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForThree);
    } else {
        waitForThree();
    }

})();