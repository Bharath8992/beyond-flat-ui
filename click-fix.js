/**
 * GMX CLICK-FIX â€” Nuclear click-through system
 * Guarantees ALL clicks reach their intended interactive targets,
 * bypassing any invisible overlay that might intercept them.
 * 
 * How it works:
 * 1. Listens for clicks in capture phase (runs FIRST, before any other handler)
 * 2. If the click target is NOT interactive, uses elementsFromPoint() to find
 *    the actual interactive element at those coordinates
 * 3. Dispatches a new MouseEvent directly to that element
 * 4. Also continuously monitors for elements blocking clicks and forces
 *    pointer-events: none on non-interactive fixed overlays
 */
(function() {
  'use strict';

  // Interactive element selectors
  var INTERACTIVE = 'a,button,input,textarea,select,summary,details,' +
    '[role="button"],[tabindex],.gmx-click-card,.custom-option,' +
    '.custom-select-trigger,.si-dot,.submit-btn,.wa-btn,.wa-fab,' +
    '.back-to-top,.hamburger-btn,.lgpd-accept,.lgpd-reject,.faq-item,' +
    '.tunnel-tap-hint,#cube-hitbox,.tunnel-mobile-close';

  // Elements that should NEVER receive pointer events
  var BLOCKERS = '.gmx-loader,.noise-overlay,.video-bg-container,.dark-overlay,' +
    '.webgl-universe,#immersive-3d-overlay,.page-transition,.gmx-cursor,' +
    '.showreel-overlay,.showreel-hud,.hero-content';

  // Form-area elements that must always be clickable
  var FORM_INTERACTIVE = '.application-form input,.application-form textarea,' +
    '.application-form button,.application-form select,.application-form [role="button"],' +
    '.application-form .custom-option,.application-form .custom-select-trigger,' +
    '.application-form .submit-btn,.application-form .wa-btn,.application-form a';

  function isInteractive(el) {
    if (!el || el === document || el === document.documentElement || el === document.body) return false;
    try { return el.matches(INTERACTIVE); } catch(e) { return false; }
  }

  function findInteractive(el) {
    while (el && el !== document.body && el !== document) {
      if (isInteractive(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Layer 1: Force pointer-events:none on known blockers
  function neutralizeBlockers() {
    try {
      document.querySelectorAll(BLOCKERS).forEach(function(el) {
        if (el.style.pointerEvents !== 'none') {
          el.style.pointerEvents = 'none';
        }
      });
    } catch(e) {}
  }

  // Layer 2: Scan fixed/absolute positioned overlays that may block clicks
  // Uses targeted selectors instead of querySelectorAll('*') for performance
  var FIXED_CANDIDATES = '.gmx-loader,.noise-overlay,.video-bg-container,.dark-overlay,' +
    '.webgl-universe,#immersive-3d-overlay,.page-transition,.gmx-cursor,' +
    '.showreel-overlay,.showreel-hud,.hero-content,[style*="position:fixed"],' +
    '[style*="position: fixed"],.scroll-container';

  function scanFixedElements() {
    try {
      var candidates = document.querySelectorAll(FIXED_CANDIDATES);
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (isInteractive(el) || findInteractive(el)) continue;
        if (el.querySelector && el.querySelector(INTERACTIVE)) continue;
        var style = window.getComputedStyle(el);
        if (style.display === 'none') continue;
        var rect = el.getBoundingClientRect();
        var coverage = (rect.width * rect.height) / (window.innerWidth * window.innerHeight);
        if (coverage > 0.3 && style.pointerEvents !== 'none') {
          el.style.pointerEvents = 'none';
        }
      }
    } catch(e) {}
  }

  // Layer 3: Click-through forwarder
  document.addEventListener('click', function(e) {
    // Don't interfere with already-handled events or synthetic events
    if (e._gmxForwarded) return;
    
    // If the target IS interactive or has an interactive ancestor, let it through
    if (findInteractive(e.target)) return;
    
    // The click landed on a non-interactive element â€” likely a blocker
    // Find the actual interactive element at these coordinates
    var elements = document.elementsFromPoint(e.clientX, e.clientY);
    
    for (var i = 0; i < elements.length; i++) {
      var interactive = findInteractive(elements[i]);
      if (interactive) {
        console.log('[GMX Click-Fix] Forwarding click from', e.target.tagName + '.' + (e.target.className || '').toString().split(' ')[0], 'to', interactive.tagName + '.' + (interactive.className || '').toString().split(' ')[0]);
        
        // Stop the original event
        e.stopImmediatePropagation();
        e.preventDefault();
        
        // Create and dispatch a new click event on the correct target
        var newEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          view: window
        });
        newEvent._gmxForwarded = true;
        interactive.dispatchEvent(newEvent);
        return;
      }
    }
  }, true); // CAPTURE phase â€” runs before everything else

  // Layer 3b: Focus forwarder â€” for inputs/textareas that need focus, not just click
  document.addEventListener('mousedown', function(e) {
    if (e._gmxForwarded) return;
    if (findInteractive(e.target)) return;
    
    var elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        e.stopImmediatePropagation();
        e.preventDefault();
        el.focus();
        
        var newEvent = new MouseEvent('mousedown', {
          bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY,
          view: window
        });
        newEvent._gmxForwarded = true;
        el.dispatchEvent(newEvent);
        return;
      }
      var interactive = findInteractive(el);
      if (interactive) {
        e.stopImmediatePropagation();
        var newMD = new MouseEvent('mousedown', {
          bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY,
          view: window
        });
        newMD._gmxForwarded = true;
        interactive.dispatchEvent(newMD);
        return;
      }
    }
  }, true);

  // Also handle pointerdown/mousedown for elements that rely on those
  document.addEventListener('pointerdown', function(e) {
    if (e._gmxForwarded) return;
    if (findInteractive(e.target)) return;
    
    var elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (var i = 0; i < elements.length; i++) {
      var interactive = findInteractive(elements[i]);
      if (interactive) {
        e.stopImmediatePropagation();
        var newEvent = new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          view: window
        });
        newEvent._gmxForwarded = true;
        interactive.dispatchEvent(newEvent);
        return;
      }
    }
  }, true);

  // Run blockers neutralization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      neutralizeBlockers();
      setTimeout(scanFixedElements, 2000);
      setTimeout(scanFixedElements, 5000);
    });
  } else {
    neutralizeBlockers();
    setTimeout(scanFixedElements, 1000);
    setTimeout(scanFixedElements, 4000);
  }

  // Also run after page fully loads (scripts, images, etc.)
  window.addEventListener('load', function() {
    neutralizeBlockers();
    setTimeout(scanFixedElements, 1500);
  });

  // Layer 4: Continuous form-area protection
  // When user scrolls near the form, ensure no fixed element blocks it
  var formProtectionActive = false;
  var formProtectedEls = []; // Track which elements we modified

  // Cache fixed-overlay selectors to avoid querySelectorAll('*')
  var FORM_BLOCKERS = '.wa-fab,.back-to-top,.scroll-progress-ring,.gmx-cursor,' +
    '.floating-cta,.noise-overlay,.page-transition,.showreel-overlay,.showreel-hud';

  function protectFormArea() {
    var form = document.querySelector('.application-form');
    if (!form) return;
    
    var formRect = form.getBoundingClientRect();
    var vh = window.innerHeight;
    var formInView = formRect.top < vh && formRect.bottom > 0;
    
    if (formInView && !formProtectionActive) {
      formProtectionActive = true;
      var candidates = document.querySelectorAll(FORM_BLOCKERS);
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (form.contains(el)) continue;
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none') continue;
        if (el.classList && el.classList.contains('gmx-header')) continue;
        var r = el.getBoundingClientRect();
        var overlaps = r.right > formRect.left && r.left < formRect.right &&
                       r.bottom > formRect.top && r.top < formRect.bottom;
        if (overlaps && r.width > 20 && r.height > 20) {
          if (!el._gmxOrigPE) el._gmxOrigPE = el.style.pointerEvents;
          el.style.pointerEvents = 'none';
          formProtectedEls.push(el);
        }
      }
    } else if (!formInView && formProtectionActive) {
      formProtectionActive = false;
      for (var j = 0; j < formProtectedEls.length; j++) {
        var el2 = formProtectedEls[j];
        if (el2._gmxOrigPE !== undefined) {
          el2.style.pointerEvents = el2._gmxOrigPE;
          delete el2._gmxOrigPE;
        }
      }
      formProtectedEls = [];
    }
  }
  
  // Run on scroll with throttling
  var scrollTick = false;
  window.addEventListener('scroll', function() {
    if (!scrollTick) {
      scrollTick = true;
      requestAnimationFrame(function() {
        protectFormArea();
        scrollTick = false;
      });
    }
  }, { passive: true });

  console.log('[GMX Click-Fix] Nuclear click-through system loaded');
})();