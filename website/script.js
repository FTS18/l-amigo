document.addEventListener('DOMContentLoaded', () => {
  // Navigation Toggle for Mobile
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // Carousel Logic
  const carousels = document.querySelectorAll('.carousel-container');
  
  carousels.forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    const nextButton = carousel.querySelector('.carousel-btn.next');
    const prevButton = carousel.querySelector('.carousel-btn.prev');
    
    // Create Indicators
    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.classList.add('carousel-indicators');
    const indicators = [];
    
    slides.forEach((_, idx) => {
      const indicator = document.createElement('div');
      indicator.classList.add('carousel-indicator');
      if (idx === 0) indicator.classList.add('active');
      indicator.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 768;
        const maxIndex = isMobile ? (slides.length - 1) : Math.max(0, slides.length - 2);
        currentIndex = Math.min(idx, maxIndex);
        updateSlidePosition();
      });
      indicatorsContainer.appendChild(indicator);
      indicators.push(indicator);
    });
    
    carousel.appendChild(indicatorsContainer);

    let currentIndex = 0;
    let autoPlayInterval = null;
    
    const updateSlidePosition = () => {
      const isMobile = window.innerWidth <= 768;
      const step = isMobile ? 100 : 50;
      const maxIndex = isMobile ? (slides.length - 1) : Math.max(0, slides.length - 2);
      
      if (currentIndex > maxIndex) {
        currentIndex = maxIndex;
      }
      
      track.style.transform = `translateX(-${currentIndex * step}%)`;
      indicators.forEach((ind, idx) => {
        if (idx === currentIndex) {
          ind.classList.add('active');
        } else {
          ind.classList.remove('active');
        }
      });
    };

    const nextSlide = () => {
      const isMobile = window.innerWidth <= 768;
      const maxIndex = isMobile ? (slides.length - 1) : Math.max(0, slides.length - 2);
      currentIndex = (currentIndex >= maxIndex) ? 0 : currentIndex + 1;
      updateSlidePosition();
    };

    const prevSlide = () => {
      const isMobile = window.innerWidth <= 768;
      const maxIndex = isMobile ? (slides.length - 1) : Math.max(0, slides.length - 2);
      currentIndex = (currentIndex === 0) ? maxIndex : currentIndex - 1;
      updateSlidePosition();
    };

    nextButton.addEventListener('click', nextSlide);
    prevButton.addEventListener('click', prevSlide);

    // Auto-play logic
    const startAutoPlay = () => {
      if (!autoPlayInterval) {
        autoPlayInterval = setInterval(nextSlide, 3000);
      }
    };

    const stopAutoPlay = () => {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
      }
    };

    // Pause on hover
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);

    // Only auto-play when in viewport
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            startAutoPlay();
          } else {
            stopAutoPlay();
          }
        });
      }, { threshold: 0.1 });
      observer.observe(carousel);
    } else {
      // Fallback if no observer support
      startAutoPlay();
    }
  });

  // Docs Sidebar ScrollSpy
  const sections = document.querySelectorAll('.docs-section');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');

  if (sections.length > 0 && sidebarLinks.length > 0) {
    window.addEventListener('scroll', () => {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - 150)) {
          current = section.getAttribute('id');
        }
      });

      sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
          link.classList.add('active');
        }
      });
    });
  }

  // Search Modal Logic
  const searchTrigger = document.getElementById('searchTrigger');
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  if (searchTrigger && searchModal && searchInput && searchResults) {
    const openSearch = () => {
      searchModal.style.display = 'flex';
      setTimeout(() => searchInput.focus(), 100);
    };

    const closeSearch = () => {
      searchModal.style.display = 'none';
      searchInput.value = '';
      searchResults.innerHTML = '';
    };

    searchTrigger.addEventListener('click', openSearch);

    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) closeSearch();
    });

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      searchResults.innerHTML = '';
      
      if (!query) return;

      const matches = [];
      sections.forEach(section => {
        const titleEl = section.querySelector('h1, h2, h3');
        const title = titleEl ? titleEl.innerText : 'Section';
        const text = section.innerText.toLowerCase();
        
        if (text.includes(query)) {
          matches.push({
            id: section.getAttribute('id'),
            title: title,
            preview: section.innerText.substring(0, 100).replace(/\n/g, ' ') + '...'
          });
        }
      });

      if (matches.length === 0) {
        searchResults.innerHTML = '<div style="color:#666; padding:12px; text-align:center;">No results found</div>';
        return;
      }

      matches.forEach((match, idx) => {
        const item = document.createElement('a');
        item.setAttribute('href', `#${match.id}`);
        item.style.cssText = `
          display: block;
          padding: 12px;
          background: #1a1a1a;
          border: 1px solid #222;
          color: #ccc;
          text-decoration: none;
          transition: all 0.2s ease;
        `;
        if (idx === 0) {
          item.style.borderColor = 'var(--primary)';
          item.style.background = 'rgba(255, 161, 22, 0.05)';
        }

        item.innerHTML = `
          <div style="font-weight:bold; color:var(--primary); font-size:14px; margin-bottom:4px;">${match.title}</div>
          <div style="font-size:12px; color:#888;">${match.preview}</div>
        `;

        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(255, 161, 22, 0.08)';
          item.style.borderColor = 'var(--primary)';
        });
        item.addEventListener('mouseleave', () => {
          if (idx !== 0) {
            item.style.background = '#1a1a1a';
            item.style.borderColor = '#222';
          }
        });

        item.addEventListener('click', () => {
          closeSearch();
        });

        searchResults.appendChild(item);
      });
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const firstResult = searchResults.querySelector('a');
        if (firstResult) {
          firstResult.click();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && searchModal.style.display === 'flex') {
        closeSearch();
      }
    });
  }

  // --- Scroll Progress Bar ---
  const scrollProgress = document.getElementById('scroll-progress');
  if (scrollProgress) {
    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      scrollProgress.style.width = scrolled + '%';
    });
  }

  // --- Back to Top Button ---
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTop.classList.add('show');
      } else {
        backToTop.classList.remove('show');
      }
    });

    backToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // --- Page Transition / Entrance Animations ---
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const entranceObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    entranceObserver.observe(el);
  });

  // --- Navigation Active State (Home Page) ---
  const pageSections = document.querySelectorAll('section[id]');
  const mainNavLinks = document.querySelectorAll('.nav-links a[href^="index.html#"], .nav-links a[href^="#"]');
  
  if (pageSections.length > 0 && mainNavLinks.length > 0 && !window.location.pathname.includes('docs')) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          mainNavLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(id)) {
              link.classList.add('active');
            }
          });
        }
      });
    }, { threshold: 0.3 });

    pageSections.forEach(section => {
      navObserver.observe(section);
    });
  }

  // --- Copy to Clipboard for Code Blocks ---
  document.addEventListener('click', (e) => {
    if (e.target.closest('.copy-btn')) {
      const btn = e.target.closest('.copy-btn');
      const codeBlock = btn.parentElement.querySelector('.code-block, pre, code');
      if (codeBlock) {
        const text = codeBlock.innerText;
        navigator.clipboard.writeText(text).then(() => {
          const originalText = btn.innerText;
          btn.innerText = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('copied');
          }, 2000);
        });
      }
    }
  });

  // --- Theme Toggle ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'light') {
      document.body.classList.add('light-mode');
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    } else {
      themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }

    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      let theme = 'dark';
      if (document.body.classList.contains('light-mode')) {
        theme = 'light';
        themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
      } else {
        themeToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
      }
      localStorage.setItem('theme', theme);
    });
  }

  // --- GitHub Stars Fetch ---
  const starCountEl = document.getElementById('github-stars-count');
  if (starCountEl) {
    fetch('https://api.github.com/repos/FTS18/l-amigo')
      .then(res => res.json())
      .then(data => {
        if (data.stargazers_count !== undefined) {
          starCountEl.innerText = data.stargazers_count;
        }
      })
      .catch(err => console.error('Error fetching stars:', err));
  }

  // --- Animated Stats Counter ---
  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length > 0) {
    const animateValue = (obj, start, end, duration) => {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4); // easeOutQuart
        const currentVal = Math.floor(easeProgress * (end - start) + start);
        obj.innerHTML = currentVal + (end >= 2000 ? '+' : '');
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    };

    const statsObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = parseInt(entry.target.getAttribute('data-target'), 10);
          animateValue(entry.target, 0, target, 2500);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => {
      statsObserver.observe(stat);
    });
  }

});
