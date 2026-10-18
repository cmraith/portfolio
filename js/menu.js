// The site's navigation, shared by every page: a menu button in the top right corner and the
// panel of links it opens. A page gets it by loading this file; the links live here, in one
// place, so the navigation is the same everywhere. Independent of the 3D scene.
(function () {
  // The pages. Addresses are relative to the site's root folder, where the pages sit. Under
  // Work, its projects (sub), each linking to its process page once it has one (href): the
  // others are listed, unlinked, until then.
  const PAGES = [
    { label: 'About me', href: 'about.html' },
    { label: 'Play', href: 'play.html' },
    {
      label: 'Work',
      href: 'index.html',
      sub: [
        { label: 'Digital Etch-a-Sketch', href: 'etch-a-sketch.html' },
        { label: 'Yuki', href: 'yuki.html' },
        { label: 'Pokemart Kiosk', href: 'pokemart-kiosk.html' },
        { label: 'Placeholder title', href: 'project-4.html' },
        { label: 'Placeholder title', href: 'project-5.html' },
        { label: 'Placeholder title', href: 'project-6.html' },
        { label: 'Placeholder title', href: 'project-7.html' }, // (the finish's)
      ],
    },
  ];

  // The social links are placeholders: replace each "#" with the real address.
  const SOCIAL = [
    {
      label: 'Instagram',
      href: '#',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">'
        + '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>'
        + '<circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" stroke="none"/></svg>',
    },
    {
      label: 'YouTube',
      href: '#',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path fill-rule="evenodd" '
        + 'd="M6 5h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Zm4 3.6v6.8l6-3.4-6-3.4Z"/></svg>',
    },
    {
      label: 'LinkedIn',
      href: '#',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path fill-rule="evenodd" '
        + 'd="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1.6 6.6v7.9h2.5V9.6H6.6Z'
        + 'm1.25-3.7a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9Zm3 3.7v7.9h2.5v-4.3c0-1.1.7-1.8 1.6-1.8.9 0 '
        + '1.45.6 1.45 1.8v4.3h2.5v-4.8c0-2.2-1.25-3.3-3-3.3-1.15 0-1.95.55-2.4 1.25h-.05V9.6h-2.6Z"/></svg>',
    },
  ];

  // ---------------------------------------------------------------- building it

  // Which page this is, by file name; a bare folder address is the home page.
  const here = location.pathname.split('/').pop() || 'index.html';

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Site');
  nav.innerHTML = '<button class="menu-button" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-menu">'
    + '<span></span><span></span><span></span></button>'
    + '<div class="menu" id="site-menu"><div class="social"></div></div>';
  const button = nav.querySelector('.menu-button');
  const menu = nav.querySelector('.menu');
  const social = nav.querySelector('.social');

  for (const page of PAGES) {
    const link = document.createElement('a');
    link.href = page.href;
    link.setAttribute('aria-label', page.label);
    if (page.href === here) link.setAttribute('aria-current', 'page');
    // The words roll letter by letter on hover (see ".menu > a" in style.css), so each letter
    // needs its own element and its place in the word.
    [...page.label].forEach((letter, i) => {
      const span = document.createElement('span');
      span.className = 'letter';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--i', i);
      span.textContent = letter;
      link.appendChild(span);
    });
    menu.insertBefore(link, social);
    // its projects, in a small list under it
    if (page.sub) {
      const list = document.createElement('ul');
      list.className = 'menu-sub';
      list.setAttribute('aria-label', page.label + ' projects');
      for (const item of page.sub) {
        const entry = document.createElement('li');
        const label = document.createElement(item.href ? 'a' : 'span');
        label.textContent = item.label;
        if (item.href) {
          label.href = item.href;
          if (item.href === here) label.setAttribute('aria-current', 'page');
        }
        entry.appendChild(label);
        list.appendChild(entry);
      }
      menu.insertBefore(list, social);
    }
  }

  for (const item of SOCIAL) {
    const link = document.createElement('a');
    link.className = 'icon';
    link.href = item.href;
    link.title = item.label;
    link.setAttribute('aria-label', item.label);
    link.innerHTML = item.icon;
    social.appendChild(link);
  }

  document.body.appendChild(nav);

  // ---------------------------------------------------------------- opening and closing

  function setOpen(open) {
    button.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('open', open);
  }

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';

  button.addEventListener('click', () => setOpen(!isOpen()));

  // Clicking anywhere else, or pressing Escape, closes it. A click inside an embedded frame
  // (the game on the Play page) never reaches this page, but it does take the focus away.
  document.addEventListener('click', (event) => {
    if (isOpen() && !menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  window.addEventListener('blur', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });
})();
