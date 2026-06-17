// =============================================================
// ALIGN v2 — Media View
// Books (Open Library API) & Movies (OMDB API) tracking
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { getState, setState, getDayLog, updateDayLog, subscribe, getOmdbKey } from '../state.js';
import { showBottomSheet, formGroup, formInput, formSelect } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';

let activeTab = 'books';
let containerRef = null;

export function renderMedia(container) {
  containerRef = container;
  const books = getState('books') || [];
  const movies = getState('movies') || [];

  const page = el('div', { class: 'media-page view-enter' });
  const wrap = el('div', { class: 'container' });

  // Header
  wrap.appendChild(el('div', { class: 'page-header' },
    el('span', { class: 'kicker' }, 'Library'),
    el('h2', {}, 'Media')
  ));

  // Tab switcher
  const tabContent = el('div', { class: 'media-tab-content' });
  const tabBar = el('div', { class: 'media-tab-bar' });

  const booksTab = el('button', {
    class: `media-tab${activeTab === 'books' ? ' active' : ''}`,
    onClick: () => {
      activeTab = 'books';
      booksTab.classList.add('active');
      moviesTab.classList.remove('active');
      renderBooksList(tabContent, getState('books') || [], container);
    },
  }, icon(ICONS.book, { size: 16 }), 'Books');

  const moviesTab = el('button', {
    class: `media-tab${activeTab === 'movies' ? ' active' : ''}`,
    onClick: () => {
      activeTab = 'movies';
      moviesTab.classList.add('active');
      booksTab.classList.remove('active');
      renderMoviesList(tabContent, getState('movies') || [], container);
    },
  }, icon(ICONS.film || ICONS.activity, { size: 16 }), 'Movies');

  tabBar.appendChild(booksTab);
  tabBar.appendChild(moviesTab);
  wrap.appendChild(tabBar);

  // Render initial list
  if (activeTab === 'books') {
    renderBooksList(tabContent, books, container);
  } else {
    renderMoviesList(tabContent, movies, container);
  }
  wrap.appendChild(tabContent);

  page.appendChild(wrap);
  container.appendChild(page);

  // Subscribe to changes in books and movies for instant dynamic refreshes (e.g. after API finishes loading)
  const unsubBooks = subscribe('books', (newBooks) => {
    if (container.isConnected && activeTab === 'books') {
      renderBooksList(tabContent, newBooks, container);
    }
  });

  const unsubMovies = subscribe('movies', (newMovies) => {
    if (container.isConnected && activeTab === 'movies') {
      renderMoviesList(tabContent, newMovies, container);
    }
  });

  // Cleanup subscribers when navigation unmounts the page
  const observer = new MutationObserver(() => {
    if (!container.isConnected) {
      unsubBooks();
      unsubMovies();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function renderBooksList(container, books, pageContainer) {
  container.replaceChildren();

  const reading = books.filter(b => b.status === 'reading');
  const finished = books.filter(b => b.status === 'finished');
  const toRead = books.filter(b => b.status === 'to-read');

  if (reading.length > 0) {
    container.appendChild(el('h4', { class: 'media-section-title' }, 'Currently Reading'));
    const list = el('div', { class: 'media-list stagger' });
    reading.forEach(book => list.appendChild(createBookCard(book, pageContainer)));
    container.appendChild(list);
  }

  if (toRead.length > 0) {
    container.appendChild(el('h4', { class: 'media-section-title' }, 'To Read'));
    const list = el('div', { class: 'media-list' });
    toRead.forEach(book => list.appendChild(createBookCard(book, pageContainer)));
    container.appendChild(list);
  }

  if (finished.length > 0) {
    container.appendChild(el('h4', { class: 'media-section-title' }, 'Finished'));
    const list = el('div', { class: 'media-list' });
    finished.forEach(book => list.appendChild(createBookCard(book, pageContainer)));
    container.appendChild(list);
  }

  if (books.length === 0) {
    container.appendChild(el('div', { class: 'media-empty' },
      icon(ICONS.book, { size: 40 }),
      el('p', {}, 'No books tracked yet.'),
      el('p', { class: 'caption' }, 'Add your first book below.')
    ));
  }

  container.appendChild(el('button', {
    class: 'btn btn-primary',
    style: { width: '100%', marginTop: 'var(--space-4)' },
    onClick: () => openAddBook(pageContainer),
  }, icon(ICONS.plus, { size: 16 }), 'Add Book'));
}

function createBookCard(book, pageContainer) {
  const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
  
  // Calculate average daily reading pages and days remaining
  const daysRemaining = calculateDaysRemaining(book);
  const remainingText = daysRemaining !== null
    ? `Est. ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
    : 'No active read stats';

  // Render book cover
  const coverEl = book.coverUrl
    ? el('img', { class: 'media-card-cover', src: book.coverUrl, alt: book.title })
    : el('div', { class: 'media-card-cover fallback' }, icon(ICONS.book, { size: 20 }));

  const progressSection = book.status === 'reading' && book.totalPages > 0 
    ? el('div', { class: 'media-card-progress' },
        el('div', { class: 'mini-progress-bar' },
          el('div', { class: 'mini-progress-fill', style: { width: progress + '%' } })
        ),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' } },
          el('span', { class: 'caption' }, `${book.currentPage}/${book.totalPages} pgs (${progress}%)`),
          el('span', { class: 'caption bold text-primary', style: { color: 'var(--primary)' } }, remainingText)
        ),
        el('button', {
          class: 'btn btn-secondary',
          style: { height: '28px', fontSize: 'var(--text-xs)', marginTop: '8px', padding: '0 8px', width: 'fit-content' },
          onClick: (e) => {
            e.stopPropagation();
            openLogPages(book, pageContainer);
          }
        }, icon(ICONS.edit, { size: 10 }), 'Log Pages')
      )
    : null;

  return el('div', { 
    class: 'media-card setting-tappable',
    onClick: () => openBookDetails(book, pageContainer)
  },
    coverEl,
    el('div', { class: 'media-card-info', style: { flex: '1' } },
      el('strong', { class: 'media-card-title' }, book.title),
      el('span', { class: 'media-card-author' }, book.author || 'Unknown Author'),
      progressSection,
      book.status === 'finished' && book.rating ? el('span', { class: 'media-card-rating' }, '⭐'.repeat(book.rating)) : null
    ),
    el('button', {
      class: 'media-card-action',
      'aria-label': 'Remove',
      onClick: (e) => {
        e.stopPropagation();
        const books = (getState('books') || []).filter(b => b.id !== book.id);
        setState('books', books);
        showToast(`"${book.title}" removed`, { type: 'info' });
      },
    }, icon(ICONS.trash, { size: 14 }))
  );
}

function renderMoviesList(container, movies, pageContainer) {
  container.replaceChildren();

  if (movies.length === 0) {
    container.appendChild(el('div', { class: 'media-empty' },
      icon(ICONS.film || ICONS.activity, { size: 40 }),
      el('p', {}, 'No movies tracked yet.'),
      el('p', { class: 'caption' }, 'Add a movie you\'ve watched.')
    ));
  } else {
    const list = el('div', { class: 'media-list stagger' });
    movies.forEach(movie => {
      // Render poster
      const posterEl = movie.coverUrl
        ? el('img', { class: 'media-card-cover', src: movie.coverUrl, alt: movie.title })
        : el('div', { class: 'media-card-cover fallback' }, icon(ICONS.film || ICONS.activity, { size: 20 }));

      list.appendChild(el('div', { 
        class: 'media-card setting-tappable',
        onClick: () => openMovieDetails(movie, pageContainer)
      },
        posterEl,
        el('div', { class: 'media-card-info', style: { flex: '1' } },
          el('strong', { class: 'media-card-title' }, movie.title),
          movie.year ? el('span', { class: 'caption' }, String(movie.year)) : null,
          movie.genre ? el('span', { class: 'caption italic', style: { fontStyle: 'italic' } }, movie.genre) : null,
          movie.imdbRating ? el('span', { class: 'caption bold', style: { fontWeight: 'bold' } }, `IMDb: ⭐ ${movie.imdbRating}`) : null,
          movie.rating ? el('span', { class: 'media-card-rating' }, '⭐'.repeat(movie.rating)) : null
        ),
        el('button', {
          class: 'media-card-action',
          'aria-label': 'Remove',
          onClick: (e) => {
            e.stopPropagation();
            const m = (getState('movies') || []).filter(mv => mv.id !== movie.id);
            setState('movies', m);
            showToast(`"${movie.title}" removed`, { type: 'info' });
          },
        }, icon(ICONS.trash, { size: 14 }))
      ));
    });
    container.appendChild(list);
  }

  container.appendChild(el('button', {
    class: 'btn btn-primary',
    style: { width: '100%', marginTop: 'var(--space-4)' },
    onClick: () => openAddMovie(pageContainer),
  }, icon(ICONS.plus, { size: 16 }), 'Add Movie'));
}

// ─── API Integrations ───

async function enrichBookCover(bookId, title, author) {
  try {
    const queryStr = `title=${encodeURIComponent(title)}` + (author ? `&author=${encodeURIComponent(author)}` : '');
    const res = await fetch(`https://openlibrary.org/search.json?${queryStr}&limit=1`);
    if (!res.ok) return;
    const data = await res.json();
    const doc = data.docs?.[0];

    if (doc && doc.cover_i) {
      const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      const books = getState('books') || [];
      const updated = books.map(b => b.id === bookId ? { ...b, coverUrl } : b);
      setState('books', updated);
    }
  } catch (e) {
    console.warn('Open Library API enrichment failed:', e);
  }
}

async function enrichMoviePoster(movieId, title) {
  const apiKey = getOmdbKey();
  if (!apiKey) return;

  try {
    const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.Response === 'True') {
      const coverUrl = data.Poster !== 'N/A' ? data.Poster : null;
      const movies = getState('movies') || [];
      const updated = movies.map(m => m.id === movieId ? {
        ...m,
        coverUrl,
        year: parseInt(data.Year) || m.year,
        genre: data.Genre || '',
        plot: data.Plot || '',
        imdbRating: data.imdbRating || '',
      } : m);
      setState('movies', updated);
    } else {
      showToast(`OMDB: Poster not found for "${title}"`, { type: 'warning' });
    }
  } catch (e) {
    console.warn('OMDB API enrichment failed:', e);
  }
}

// ─── Calculations ───

function calculateDaysRemaining(book) {
  const total = book.totalPages || 0;
  const current = book.currentPage || 0;
  if (total <= current) return 0;

  const logs = book.readingLog || [];
  if (logs.length === 0) return null;

  // Compute 7-day average of daily pages read
  const today = new Date();
  const limitDate = new Date(today);
  limitDate.setDate(today.getDate() - 7);

  const recentLogs = logs.filter(log => new Date(log.date) >= limitDate);
  const totalRead = recentLogs.reduce((sum, log) => sum + (log.pagesRead || 0), 0);

  // Default to conservative estimate if there are logs but average is 0
  const avgPages = Math.ceil(totalRead / 7);
  if (avgPages <= 0) return null;

  return Math.ceil((total - current) / avgPages);
}

// ─── Interactive Dialogs ───

function openAddBook(pageContainer) {
  let titleInput, authorInput, pagesInput, statusSelect;

  showBottomSheet({
    title: 'Add Book',
    render: (content) => {
      titleInput = formInput({ placeholder: 'Book title', id: 'book-title' });
      authorInput = formInput({ placeholder: 'Author', id: 'book-author' });
      pagesInput = formInput({ type: 'number', placeholder: 'Total pages', inputmode: 'numeric', id: 'book-pages' });
      statusSelect = formSelect({
        id: 'book-status',
        options: [
          { value: 'reading', label: 'Currently Reading' },
          { value: 'to-read', label: 'To Read' },
          { value: 'finished', label: 'Finished' },
        ],
      });

      content.appendChild(formGroup('Title', titleInput));
      content.appendChild(formGroup('Author', authorInput));
      content.appendChild(formGroup('Total Pages', pagesInput));
      content.appendChild(formGroup('Status', statusSelect));

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          const title = titleInput.value.trim();
          if (!title) { showToast('Enter book title', { type: 'warning' }); return; }

          const bookId = 'b' + Date.now();
          const books = [...(getState('books') || [])];
          const newBook = {
            id: bookId,
            title,
            author: authorInput.value.trim() || 'Unknown Author',
            totalPages: parseInt(pagesInput.value) || 0,
            currentPage: 0,
            status: statusSelect.value,
            rating: 0,
            readingLog: [],
            coverUrl: null,
          };
          books.push(newBook);
          setState('books', books);

          showToast(`"${title}" added`, { type: 'success' });

          // Asynchronously enrich with Open Library cover art
          enrichBookCover(bookId, title, authorInput.value.trim());

          pageContainer.replaceChildren();
          renderMedia(pageContainer);
        },
      }, 'Save Book');
      content.appendChild(saveBtn);
    },
  });
}

function openAddMovie(pageContainer) {
  let titleInput, yearInput, ratingInput;

  showBottomSheet({
    title: 'Add Movie',
    render: (content) => {
      titleInput = formInput({ placeholder: 'Movie title', id: 'movie-title' });
      yearInput = formInput({ type: 'number', placeholder: 'Year', inputmode: 'numeric', id: 'movie-year' });
      ratingInput = formSelect({
        id: 'movie-rating',
        options: [
          { value: '5', label: '⭐⭐⭐⭐⭐ Amazing' },
          { value: '4', label: '⭐⭐⭐⭐ Great' },
          { value: '3', label: '⭐⭐⭐ Good' },
          { value: '2', label: '⭐⭐ Okay' },
          { value: '1', label: '⭐ Poor' },
        ],
        selected: '4',
      });

      content.appendChild(formGroup('Title', titleInput));
      content.appendChild(formGroup('Year', yearInput));
      content.appendChild(formGroup('Rating', ratingInput));

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          const title = titleInput.value.trim();
          if (!title) { showToast('Enter movie title', { type: 'warning' }); return; }

          const movieId = 'm' + Date.now();
          const movies = [...(getState('movies') || [])];
          const newMovie = {
            id: movieId,
            title,
            year: parseInt(yearInput.value) || null,
            rating: parseInt(ratingInput.value) || 4,
            coverUrl: null,
            genre: '',
            imdbRating: '',
            watchedAt: Date.now(),
          };
          movies.push(newMovie);
          setState('movies', movies);

          showToast(`"${title}" added`, { type: 'success' });

          // Asynchronously enrich with OMDB details (if key is set)
          enrichMoviePoster(movieId, title);

          pageContainer.replaceChildren();
          renderMedia(pageContainer);
        },
      }, 'Save Movie');
      content.appendChild(saveBtn);
    },
  });
}

function openLogPages(book, pageContainer) {
  let pagesInput, durationInput;

  showBottomSheet({
    title: `Log Reading: ${book.title}`,
    render: (content) => {
      pagesInput = formInput({ type: 'number', placeholder: 'Pages read today', inputmode: 'numeric', id: 'log-pages-read' });
      durationInput = formInput({ type: 'number', placeholder: 'Time spent in minutes (optional)', inputmode: 'numeric', id: 'log-pages-duration' });
      
      content.appendChild(formGroup('How many pages did you read?', pagesInput));
      content.appendChild(formGroup('How many minutes did it take? (optional)', durationInput));

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          const pgs = parseInt(pagesInput.value) || 0;
          if (pgs <= 0) { showToast('Enter valid pages', { type: 'warning' }); return; }

          const mins = parseInt(durationInput.value) || 0;
          const todayDate = getState('dateStr') || new Date().toISOString().split('T')[0];

          // 1. Update book local reading details
          const books = getState('books') || [];
          const updated = books.map(b => {
            if (b.id === book.id) {
              const current = (b.currentPage || 0) + pgs;
              const max = b.totalPages || Infinity;
              const finalCurrent = Math.min(current, max);
              const status = finalCurrent >= max ? 'finished' : b.status;
              const readingLog = [...(b.readingLog || [])];
              readingLog.push({ 
                date: todayDate, 
                timestamp: Date.now(),
                pagesRead: pgs,
                durationMin: mins > 0 ? mins : null
              });

              return {
                ...b,
                currentPage: finalCurrent,
                status,
                readingLog,
              };
            }
            return b;
          });
          setState('books', updated);

          // 2. Sync to PWA Daily Log (for dashboard metrics/rings)
          const day = getDayLog(todayDate);
          updateDayLog(todayDate, { pagesRead: (day.pagesRead || 0) + pgs });

          showToast(`Logged +${pgs} pages`, { type: 'success' });
          pageContainer.replaceChildren();
          renderMedia(pageContainer);
        },
      }, 'Save Progress');
      content.appendChild(saveBtn);
    },
  });
}

function openBookDetails(book, pageContainer) {
  const sheet = showBottomSheet({
    title: book.title,
    render: (content) => {
      const headerRow = el('div', { style: { display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' } },
        book.coverUrl 
          ? el('img', { src: book.coverUrl, style: { width: '80px', height: '120px', borderRadius: 'var(--radius-md)', objectFit: 'cover', boxShadow: 'var(--shadow-md)' } })
          : el('div', { style: { width: '80px', height: '120px', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' } }, icon(ICONS.book, { size: 24 })),
        el('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 } },
          el('h3', { style: { margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' } }, book.title),
          el('span', { style: { color: 'var(--text-subtle)', marginBottom: 'var(--space-2)' } }, `By ${book.author || 'Unknown'}`),
          el('span', { class: `badge badge-${book.status === 'finished' ? 'green' : book.status === 'reading' ? 'coral' : 'blue'}`, style: { width: 'fit-content' } }, book.status.toUpperCase())
        )
      );
      content.appendChild(headerRow);

      if (book.status === 'reading' || book.status === 'finished') {
        const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
        const progressSection = el('div', { style: { background: 'var(--surface-soft)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' } },
          el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' } },
            el('strong', {}, 'Reading Progress'),
            el('span', {}, `${book.currentPage} / ${book.totalPages} pgs (${progress}%)`)
          ),
          el('div', { class: 'mini-progress-bar', style: { height: '8px', background: 'var(--hairline-soft)' } },
            el('div', { class: 'mini-progress-fill', style: { width: progress + '%', height: '100%', background: 'var(--primary)', borderRadius: 'var(--radius-full)' } })
          )
        );
        content.appendChild(progressSection);
      }

      if (book.status === 'finished') {
        const setRating = (val) => {
          const books = getState('books') || [];
          const updated = books.map(b => b.id === book.id ? { ...b, rating: val } : b);
          setState('books', updated);
          showToast(`Rated "${book.title}" ${val} stars`, { type: 'success' });
          sheet.close();
          openBookDetails({ ...book, rating: val }, pageContainer);
        };

        const stars = el('div', { style: { display: 'flex', gap: '4px' } });
        for (let i = 1; i <= 5; i++) {
          const starIcon = el('span', {
            style: { 
              cursor: 'pointer', 
              fontSize: '22px', 
              color: i <= (book.rating || 0) ? '#f5c518' : 'var(--text-subtle)' 
            },
            onClick: () => setRating(i)
          }, '★');
          stars.appendChild(starIcon);
        }

        const ratingRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' } },
          el('strong', {}, 'Your Rating:'),
          stars
        );
        content.appendChild(ratingRow);
      }

      content.appendChild(el('h4', { style: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' } }, 'Reading Logs'));
      
      const logList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' } });
      const logs = book.readingLog || [];
      
      if (logs.length === 0) {
        logList.appendChild(el('p', { class: 'caption', style: { color: 'var(--text-muted)', fontStyle: 'italic' } }, 'No sessions logged yet.'));
      } else {
        const sortedLogs = [...logs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        sortedLogs.forEach(log => {
          const logDate = log.timestamp 
            ? new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : log.date;
            
          const durationText = log.durationMin 
            ? ` (${log.durationMin} mins, ${Math.round((log.pagesRead / log.durationMin) * 10) / 10} pgs/min)` 
            : '';
            
          logList.appendChild(el('div', { 
            style: { 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: 'var(--space-2) var(--space-3)', 
              background: 'var(--surface-soft)', 
              borderRadius: 'var(--radius-sm)' 
            } 
          },
            el('span', { class: 'caption', style: { color: 'var(--text-subtle)' } }, logDate),
            el('strong', { style: { fontSize: 'var(--text-sm)' } }, `+${log.pagesRead} pages${durationText}`)
          ));
        });
      }
      content.appendChild(logList);

      const actions = el('div', { style: { display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' } });
      if (book.status === 'reading') {
        actions.appendChild(el('button', {
          class: 'btn btn-primary',
          style: { flex: 1 },
          onClick: () => {
            sheet.close();
            openLogPages(book, pageContainer);
          }
        }, 'Log Reading Session'));
      }
      content.appendChild(actions);
    }
  });
}

function openMovieDetails(movie, pageContainer) {
  showBottomSheet({
    title: movie.title,
    render: (content) => {
      const headerRow = el('div', { style: { display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' } },
        movie.coverUrl 
          ? el('img', { src: movie.coverUrl, style: { width: '80px', height: '120px', borderRadius: 'var(--radius-md)', objectFit: 'cover', boxShadow: 'var(--shadow-md)' } })
          : el('div', { style: { width: '80px', height: '120px', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' } }, icon(ICONS.film || ICONS.activity, { size: 24 })),
        el('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 } },
          el('h3', { style: { margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' } }, movie.title),
          movie.year ? el('span', { style: { color: 'var(--text-subtle)' } }, `Year: ${movie.year}`) : null,
          movie.genre ? el('span', { class: 'caption', style: { fontStyle: 'italic', color: 'var(--text-muted)' } }, movie.genre) : null,
          movie.imdbRating ? el('span', { class: 'caption bold', style: { fontWeight: 'bold', color: 'var(--primary)', marginTop: 'var(--space-1)' } }, `IMDb: ⭐ ${movie.imdbRating}`) : null
        )
      );
      content.appendChild(headerRow);

      if (movie.plot) {
        content.appendChild(el('p', { class: 'caption', style: { color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-4)' } }, movie.plot));
      }

      content.appendChild(el('div', { style: { background: 'var(--surface-soft)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' } },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          el('strong', {}, 'Watched Details'),
          movie.rating ? el('span', { style: { color: '#f5c518', fontSize: '16px' } }, '★'.repeat(movie.rating)) : null
        ),
        movie.watchedAt ? el('p', { class: 'caption', style: { margin: '8px 0 0 0', color: 'var(--text-subtle)' } }, `Watched on: ${new Date(movie.watchedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`) : null
      ));
    }
  });
}
