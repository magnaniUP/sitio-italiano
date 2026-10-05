/**
 * OFFERTE SALUTE - Script Unificato Vanilla JS
 * Menu mobile, Carosello Recensioni, Prodotti correlati e Accordion FAQ.
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Menu Mobile
  const toggleBtn = document.getElementById('mobileNavToggle');
  const drawer = document.getElementById('mobileMenuDrawer');
  const mobileLinks = document.querySelectorAll('.mobile-anchor');

  function toggleMenu(forceState) {
    if (!toggleBtn || !drawer) return;
    const isExpanded = forceState !== undefined 
      ? forceState 
      : toggleBtn.getAttribute('aria-expanded') !== 'true';

    toggleBtn.setAttribute('aria-expanded', String(isExpanded));
    toggleBtn.classList.toggle('is-active', isExpanded);
    drawer.classList.toggle('is-open', isExpanded);

    if (isExpanded) {
      drawer.removeAttribute('hidden');
    } else {
      drawer.setAttribute('hidden', '');
    }
  }

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => toggleMenu());
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => toggleMenu(false));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggleBtn.getAttribute('aria-expanded') === 'true') {
        toggleMenu(false);
        toggleBtn.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && toggleBtn.getAttribute('aria-expanded') === 'true') {
        toggleMenu(false);
      }
    });
  }

  // 2. Carosello Recensioni
  const reviewsTrack = document.getElementById('reviewsTrack');
  const prevBtn = document.getElementById('reviewsPrevBtn');
  const nextBtn = document.getElementById('reviewsNextBtn');
  const dots = document.querySelectorAll('.reviews-pagination-dots .pagination-dot');

  if (reviewsTrack && prevBtn && nextBtn) {
    function getScrollAmount() {
      const card = reviewsTrack.querySelector('.review-card');
      return card ? card.offsetWidth + 18 : 300;
    }

    prevBtn.addEventListener('click', () => {
      reviewsTrack.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      reviewsTrack.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
    });

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        const scrollAmt = getScrollAmount();
        reviewsTrack.scrollTo({ left: scrollAmt * idx, behavior: 'smooth' });
      });
    });

    reviewsTrack.addEventListener('scroll', () => {
      const scrollLeft = reviewsTrack.scrollLeft;
      const scrollAmt = getScrollAmount();
      const activeIdx = Math.min(dots.length - 1, Math.round(scrollLeft / scrollAmt));
      dots.forEach((d, i) => {
        const isActive = i === activeIdx;
        d.classList.toggle('is-active', isActive);
        d.setAttribute('aria-selected', String(isActive));
      });
    }, { passive: true });
  }

  // 3. Prodotti Correlati
  document.querySelectorAll('.btn-product-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetHref = btn.getAttribute('href');
      if (targetHref && targetHref.startsWith('#')) {
        const targetEl = document.querySelector(targetHref);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // 4. Accordion FAQ (Funzionamento Robusto)
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    const panel = item.querySelector('.faq-panel');

    if (!trigger || !panel) return;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = item.classList.contains('is-open');

      // Chiudi tutti gli altri elementi
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('is-open');
          const otherTrigger = otherItem.querySelector('.faq-trigger');
          const otherPanel = otherItem.querySelector('.faq-panel');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
          if (otherPanel) {
            otherPanel.setAttribute('hidden', '');
            otherPanel.style.display = 'none';
          }
        }
      });

      // Alterna lo stato dell'elemento corrente
      if (isOpen) {
        item.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        panel.setAttribute('hidden', '');
        panel.style.display = 'none';
      } else {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.removeAttribute('hidden');
        panel.style.display = 'block';
      }
    });
  });

  // 5. Dynamic Footer Year
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
