(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
   * 1. APPARITIONS FLUIDES AU SCROLL (IntersectionObserver)
   * ========================================================= */
  const revealElements = document.querySelectorAll('.reveal');

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('is-visible'));
  }

  /* =========================================================
   * 2. JOURNAL DE BORD : NAVIRE, PROGRESSION & CAP EN DIRECT
   * ========================================================= */
  const trackEl = document.querySelector('.expedition-track');
  const fillEl = document.getElementById('expedition-fill');
  const vesselEl = document.getElementById('expedition-vessel');
  const statusEl = document.getElementById('expedition-status');
  const coordsEl = document.getElementById('expedition-coords');
  const waypointSections = Array.from(document.querySelectorAll('[data-waypoint]'));

  let ticking = false;

  const updateExpeditionBar = () => {
    ticking = false;
    if (!trackEl || !fillEl || !vesselEl) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;

    fillEl.style.transform = `scaleX(${progress})`;

    const travelDistance = Math.max(trackEl.clientWidth - vesselEl.offsetWidth, 0);
    vesselEl.style.transform = `translate3d(${(travelDistance * progress).toFixed(1)}px, 0, 0)`;

    const probeY = scrollTop + window.innerHeight * 0.32;
    let activeSection = waypointSections[0];

    for (const section of waypointSections) {
      if (section.offsetTop <= probeY) {
        activeSection = section;
      }
    }

    if (activeSection) {
      if (statusEl && activeSection.dataset.waypoint) {
        statusEl.textContent = activeSection.dataset.waypoint;
      }
      if (coordsEl && activeSection.dataset.coords) {
        coordsEl.textContent = activeSection.dataset.coords;
      }
    }
  };

  const requestExpeditionUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateExpeditionBar);
      ticking = true;
    }
  };

  window.addEventListener('scroll', requestExpeditionUpdate, { passive: true });
  window.addEventListener('resize', requestExpeditionUpdate, { passive: true });
  updateExpeditionBar();

  /* =========================================================
   * 3. CARTE INTERACTIVE DU PARCOURS (LEAFLET)
   * ========================================================= */
  const initJourneyMap = () => {
    const mapContainer = document.getElementById('journey-map');
    if (!mapContainer || typeof window.L === 'undefined') return;

    const L = window.L;

    const journeySteps = [
      {
        num: '01',
        city: 'Dax',
        period: '2019 — 2022',
        coords: [43.7102, -1.0537],
        coordsLabel: "43°42'N · 01°03'O — DAX",
        zoom: 10,
        title: 'Dax — Point de départ',
        items: [
          '<strong>Baccalauréat Scientifique</strong> — Lycée de Borda (2019/2020)',
          '<strong>Employé polyvalent</strong> — Intermarché (Étés 2021 & 2022)',
        ],
        actionsHtml: '',
      },
      {
        num: '02',
        city: 'Bordeaux',
        period: '2021 — 2023',
        coords: [44.8378, -0.5792],
        coordsLabel: "44°50'N · 00°34'O — BORDEAUX",
        zoom: 10,
        title: 'Bordeaux — Économie & Data',
        items: [
          '<strong>L1 et L2 Économie et Gestion</strong> — Université de Bordeaux',
          'Statistiques appliquées, probabilités, démographie, Access et Python.',
        ],
        actionsHtml: '',
      },
      {
        num: '03',
        city: 'Cauterets',
        period: 'Hivers 2023 — 2025',
        coords: [42.8895, -0.1136],
        coordsLabel: "42°53'N · 00°06'O — CAUTERETS",
        zoom: 10,
        title: 'Cauterets — Expérience terrain & autonomie',
        items: [
          '<strong>Réceptionniste de nuit</strong> — Garden City *** (Hivers 2023-2024 & 2024-2025)',
          '~20 % de clientèle internationale, gestion nocturne, sécurisation et formation.',
        ],
        actionsHtml: '',
      },
      {
        num: '04',
        city: 'Nice',
        period: '2025 — 2026',
        coords: [43.7102, 7.2620],
        coordsLabel: "43°42'N · 07°15'E — NICE",
        zoom: 10,
        title: 'Nice — Spécialisation SIG & Géomarketing',
        items: [
          '<strong>Licence Pro Cartographie, Topographie & SIG</strong> — Mention Bien (15,35/20, 2e de promo)',
          '<strong>Stage Geospatial Data Analyst</strong> — Régie Ligne d\'Azur (Mai à Août 2026)',
        ],
        actionsHtml: `
          <div class="map-popup-actions">
            <a href="#modal-stage" class="map-popup-link js-modal-trigger" data-modal-target="modal-stage">Étude de cas RLA</a>
            <a href="#modal-diploma" class="map-popup-link js-modal-trigger" data-modal-target="modal-diploma">Relevé LP SIG</a>
          </div>
        `,
      },
    ];

    const map = L.map(mapContainer, {
      scrollWheelZoom: false,
      zoomControl: true,
    });

// 1. Plan IGN v2 (Géoplateforme — gratuit, sans clé API, idéal pour la France)
    const ignPlan = L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png' +
      '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      {
        attribution: '&copy; IGN - Géoplateforme',
        maxZoom: 18,
      }
    );

    // 2. Topographique (OpenTopoMap — courbes de niveau & relief)
    const openTopo = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap, SRTM | &copy; OpenTopoMap',
        maxZoom: 17,
      }
    );

    // 3. OpenStreetMap classique
    const osmStandard = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }
    );

    // 4. Photographies aériennes IGN (BD ORTHO)
    const ignOrtho = L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
      '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      {
        attribution: '&copy; IGN - Géoplateforme',
        maxZoom: 18,
      }
    );

    // Fond affiché par défaut
    ignPlan.addTo(map);

    // Sélecteur de fonds de carte en haut à droite
    const baseMaps = {
      '🗺️ Plan IGN': ignPlan,
      '⛰️ Topographique': openTopo,
      '🌍 OpenStreetMap': osmStandard,
      '🛰️ Satellite IGN': ignOrtho,
    };

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // Retire la teinte parchemin sur la vue satellite
    map.on('baselayerchange', (e) => {
      mapContainer.classList.toggle('is-raw-tiles', e.name === '🛰️ Satellite IGN');
    });

    const routeCoords = journeySteps.map((step) => step.coords);

    // Tracé chronologique global en pointillés
    L.polyline(routeCoords, {
      color: '#115E60',
      weight: 3,
      opacity: 0.78,
      dashArray: '8, 8',
    }).addTo(map);

    // Segment actif mis en surbrillance en laiton
    const activeSegmentLine = L.polyline([], {
      color: '#C89564',
      weight: 4,
      opacity: 0.95,
    }).addTo(map);

    const stepButtons = Array.from(document.querySelectorAll('.journey-step-btn'));
    const activeBadgeEl = document.getElementById('journey-active-coords');
    const prevBtn = document.getElementById('map-prev-step');
    const nextBtn = document.getElementById('map-next-step');
    const resetBtn = document.getElementById('map-reset-view');

    let currentStepIndex = 3;
    const markers = [];

    const createPinIcon = (num, isActive) =>
      L.divIcon({
        className: 'map-pin-wrapper',
        html: `<div class="map-pin${isActive ? ' is-active' : ''}">${num}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

    const buildPopupHtml = (step) => `
      <div class="map-popup">
        <span class="map-popup-kicker">ÉTAPE ${step.num} · ${step.period}</span>
        <h4>${step.title}</h4>
        <ul>${step.items.map((item) => `<li>${item}</li>`).join('')}</ul>
        ${step.actionsHtml}
      </div>
    `;

    journeySteps.forEach((step, index) => {
      const marker = L.marker(step.coords, {
        icon: createPinIcon(step.num, index === currentStepIndex),
      }).addTo(map);

      marker.bindPopup(buildPopupHtml(step), { maxWidth: 290 });
      marker.on('click', () => {
        selectStep(index, { fly: true, openPopup: true });
      });

      markers.push(marker);
    });

    const fitAllSteps = () => {
      const bounds = L.latLngBounds(routeCoords).pad(0.24);
      map.fitBounds(bounds, { animate: !prefersReducedMotion });
      if (activeBadgeEl) {
        activeBadgeEl.textContent = 'VUE GLOBALE · DAX → BORDEAUX → CAUTERETS → NICE';
      }
      activeSegmentLine.setLatLngs(routeCoords);
    };

    const selectStep = (index, options = { fly: true, openPopup: true }) => {
      currentStepIndex = (index + journeySteps.length) % journeySteps.length;
      const step = journeySteps[currentStepIndex];

      // Mise à jour des boutons latéraux
      stepButtons.forEach((btn, idx) => {
        const active = idx === currentStepIndex;
        btn.classList.toggle('is-active', active);
        if (active) {
          btn.setAttribute('aria-current', 'true');
        } else {
          btn.removeAttribute('aria-current');
        }
      });

      // Mise à jour des marqueurs
      markers.forEach((marker, idx) => {
        marker.setIcon(createPinIcon(journeySteps[idx].num, idx === currentStepIndex));
      });

      // Surbrillance du tracé parcouru jusqu'à l'étape sélectionnée
      activeSegmentLine.setLatLngs(routeCoords.slice(0, currentStepIndex + 1));

      if (activeBadgeEl) {
        activeBadgeEl.textContent = step.coordsLabel;
      }

      if (options.fly) {
        if (prefersReducedMotion) {
          map.setView(step.coords, step.zoom, { animate: false });
        } else {
          map.flyTo(step.coords, step.zoom, { duration: 1.05, easeLinearity: 0.25 });
        }
      }

      if (options.openPopup) {
        markers[currentStepIndex].openPopup();
      }
    };

    // Vue globale au chargement (tout l'itinéraire visible d'un coup d'œil)
    fitAllSteps();

    stepButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.stepIndex);
        if (!Number.isNaN(idx)) {
          selectStep(idx, { fly: true, openPopup: true });
        }
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        selectStep(currentStepIndex - 1, { fly: true, openPopup: true });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        selectStep(currentStepIndex + 1, { fly: true, openPopup: true });
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        map.closePopup();
        fitAllSteps();
      });
    }
  };

  initJourneyMap();

  /* =========================================================
   * 4. GESTION EMPILÉE DES MODALES & LIGHTBOXES
   * ========================================================= */
  const modalStack = [];
  const lightboxIds = Array.from(document.querySelectorAll('.modal-lightbox[data-lightbox-group="stage"]')).map(
    (el) => el.id
  );

  const lockBodyScroll = () => {
    document.body.classList.add('modal-open');
  };

  const unlockBodyScrollIfEmpty = () => {
    if (modalStack.length === 0) {
      document.body.classList.remove('modal-open');
    }
  };

  const openModalById = (modalId, triggerEl = null) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modalStack.some((item) => item.modal === modal)) return;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modalStack.push({ modal, triggerEl: triggerEl || document.activeElement });
    lockBodyScroll();

    if (!modal.classList.contains('modal-lightbox')) {
      const content = modal.querySelector('.modal-content');
      if (content) content.scrollTop = 0;
    }

    const closeControl = modal.querySelector('.js-modal-close');
    if (closeControl) {
      closeControl.focus({ preventScroll: true });
    }
  };

  const closeTopModal = () => {
    const top = modalStack.pop();
    if (!top) return;

    top.modal.classList.remove('is-open');
    top.modal.setAttribute('aria-hidden', 'true');
    unlockBodyScrollIfEmpty();

    if (window.location.hash === `#${top.modal.id}`) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (top.triggerEl && typeof top.triggerEl.focus === 'function') {
      top.triggerEl.focus({ preventScroll: true });
    }
  };

  const switchLightbox = (direction) => {
    const top = modalStack[modalStack.length - 1];
    if (!top || !top.modal.classList.contains('modal-lightbox')) return;

    const currentIndex = lightboxIds.indexOf(top.modal.id);
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + direction + lightboxIds.length) % lightboxIds.length;
    const nextModal = document.getElementById(lightboxIds[nextIndex]);
    if (!nextModal) return;

    top.modal.classList.remove('is-open');
    top.modal.setAttribute('aria-hidden', 'true');

    nextModal.classList.add('is-open');
    nextModal.setAttribute('aria-hidden', 'false');
    top.modal = nextModal;
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.js-modal-trigger, .js-lightbox-trigger');
    if (trigger) {
      const targetId = trigger.dataset.modalTarget || trigger.getAttribute('href')?.replace('#', '');
      if (targetId) {
        event.preventDefault();
        openModalById(targetId, trigger);
      }
      return;
    }

    const closeBtn = event.target.closest('.js-modal-close');
    if (closeBtn) {
      event.preventDefault();
      closeTopModal();
      return;
    }

    if (event.target.closest('.js-lightbox-prev')) {
      event.preventDefault();
      switchLightbox(-1);
      return;
    }

    if (event.target.closest('.js-lightbox-next')) {
      event.preventDefault();
      switchLightbox(1);
      return;
    }

    const modalAnchor = event.target.closest('.js-modal-anchor');
    if (modalAnchor) {
      const targetId = modalAnchor.getAttribute('href')?.replace('#', '');
      const targetEl = targetId ? document.getElementById(targetId) : null;
      if (targetEl) {
        event.preventDefault();
        targetEl.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }
      return;
    }

    const activeTop = modalStack[modalStack.length - 1];
    if (activeTop && event.target === activeTop.modal) {
      closeTopModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (modalStack.length === 0) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeTopModal();
    } else if (event.key === 'ArrowRight') {
      switchLightbox(1);
    } else if (event.key === 'ArrowLeft') {
      switchLightbox(-1);
    }
  });

  const initialHash = window.location.hash.replace('#', '');
  if (initialHash) {
    const targetModal = document.getElementById(initialHash);
    if (targetModal && targetModal.classList.contains('modal')) {
      if (targetModal.classList.contains('modal-lightbox')) {
        openModalById('modal-stage');
      }
      openModalById(initialHash);
    }
  }
})();