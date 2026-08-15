import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, X, Trash2, Pencil, Camera, Search, User,
  Tag, FileText, CheckCircle, Hash, Library, Quote,
  BarChart3, Bookmark, BookMarked, LayoutDashboard, Star, Target
} from 'lucide-react';
import { downscaleFile, shrinkExisting } from '../lib/downscale';
import { store } from '../lib/store';
import { useT, t as trs } from '../lib/lang';

type BookStatus = 'wishlist' | 'to-read' | 'reading' | 'completed';

interface BookNote {
  id: string;
  type: 'quote' | 'note';
  text: string;
  page?: number;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  cover?: string; // base64
  startedDate?: string;
  completedDate?: string;
  notes: BookNote[];
  createdAt: string;
}

// The category string is stored on the book, so it stays Malay as data — only the label switches.
const CATEGORIES = ['Fiksyen', 'Bukan Fiksyen', 'Motivasi', 'Perniagaan', 'Biografi', 'Sains', 'Fantasi', 'Lain-lain'];
const CATEGORY_EN: Record<string, string> = {
  Fiksyen: 'Fiction',
  'Bukan Fiksyen': 'Non-fiction',
  Motivasi: 'Motivation',
  Perniagaan: 'Business',
  Biografi: 'Biography',
  Sains: 'Science',
  Fantasi: 'Fantasy',
  'Lain-lain': 'Other',
};
const catLabel = (c: string) => trs(c, CATEGORY_EN[c] ?? c);
const ADD_OWN = () => trs('Tambah Sendiri...', 'Add your own...');

const STATUS_META: Record<BookStatus, { ms: string; en: string; cls: string; dot: string }> = {
  'wishlist': { ms: 'Senarai Hajat', en: 'Wishlist', cls: 'bg-rose-500/15 text-rose-500', dot: 'bg-rose-500' },
  'to-read': { ms: 'Nak Baca', en: 'To Read', cls: 'bg-amber-500/15 text-amber-500', dot: 'bg-amber-500' },
  'reading': { ms: 'Sedang Baca', en: 'Reading', cls: 'bg-violet-500/15 text-violet-500', dot: 'bg-violet-500' },
  'completed': { ms: 'Selesai', en: 'Finished', cls: 'bg-emerald-500/15 text-emerald-500', dot: 'bg-emerald-500' },
};

const STATUS_OPTIONS: { value: BookStatus; ms: string; en: string }[] = [
  { value: 'to-read', ms: 'Nak Baca (Ada)', en: 'To Read (Owned)' },
  { value: 'reading', ms: 'Sedang Dibaca', en: 'Reading' },
  { value: 'completed', ms: 'Selesai', en: 'Finished' },
  { value: 'wishlist', ms: 'Senarai Hajat', en: 'Wishlist' },
];

type Tab = 'dashboard' | 'library' | 'reading' | 'completed' | 'wishlist' | 'notes' | 'stats';

const todayISO = () => new Date().toISOString().split('T')[0];

export default function BookTracker() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [books, setBooks] = useState<Book[]>(() => {
    const saved = store.getItem('book_tracker_data');
    return saved ? JSON.parse(saved) : [];
  });
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = store.getItem('book_tracker_custom_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [totalPages, setTotalPages] = useState('');
  const [status, setStatus] = useState<BookStatus>('to-read');
  const [cover, setCover] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes & Quotes tab state
  const [noteBookId, setNoteBookId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [notePage, setNotePage] = useState('');
  const [noteType, setNoteType] = useState<'quote' | 'note'>('quote');

  useEffect(() => {
    store.setItem('book_tracker_data', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    store.setItem('book_tracker_custom_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // One-shot: covers saved before downscaling existed are multi-MB. Runs once per device.
  useEffect(() => {
    if (localStorage.getItem('sk_img_v2_books')) return;
    shrinkExisting(books, 'cover', 300).then(({ items: next, changed }) => {
      if (changed) setBooks(next);
      localStorage.setItem('sk_img_v2_books', '1');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setCategory(CATEGORIES[0]);
    setTotalPages('');
    setStatus('to-read');
    setCover('');
    setFormNotes('');
    setEditingBook(null);
    setIsAdding(false);
  };

  const openAdd = (preset?: BookStatus) => {
    resetForm();
    if (preset) setStatus(preset);
    setIsAdding(true);
  };

  const handleEdit = (book: Book) => {
    setTitle(book.title);
    setAuthor(book.author);
    setCategory(book.category);
    setTotalPages(book.totalPages ? book.totalPages.toString() : '');
    setStatus(book.status);
    setCover(book.cover || '');
    setFormNotes('');
    setEditingBook(book);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const pages = parseInt(totalPages) || 0;

    if (editingBook) {
      setBooks(books.map(b => {
        if (b.id !== editingBook.id) return b;
        const becameCompleted = status === 'completed' && b.status !== 'completed';
        const startedReading = status === 'reading' && !b.startedDate;
        return {
          ...b,
          title: title.trim(),
          author: author.trim(),
          category,
          totalPages: pages,
          status,
          cover,
          currentPage: status === 'completed' ? (pages || b.currentPage) : Math.min(b.currentPage, pages || b.currentPage),
          startedDate: startedReading ? todayISO() : b.startedDate,
          completedDate: becameCompleted ? todayISO() : (status === 'completed' ? b.completedDate : undefined),
        };
      }));
    } else {
      const newBook: Book = {
        id: Date.now().toString(),
        title: title.trim(),
        author: author.trim(),
        category,
        totalPages: pages,
        currentPage: status === 'completed' ? pages : 0,
        status,
        cover,
        startedDate: status === 'reading' || status === 'completed' ? todayISO() : undefined,
        completedDate: status === 'completed' ? todayISO() : undefined,
        notes: formNotes.trim()
          ? [{ id: Date.now().toString() + 'n', type: 'note', text: formNotes.trim(), createdAt: todayISO() }]
          : [],
        createdAt: todayISO(),
      };
      setBooks([newBook, ...books]);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm(trs('Padam buku ini dan notanya?', 'Delete this book and its notes?'))) {
      setBooks(books.filter(b => b.id !== id));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 300px: covers only ever render as thumbnails.
      downscaleFile(file, 300).then(setCover).catch(() => {});
    }
  };

  // Update reading progress (used by quick buttons)
  const updateProgress = (book: Book, delta: number) => {
    setBooks(books.map(b => {
      if (b.id !== book.id) return b;
      const max = b.totalPages || 0;
      let next = Math.max(0, b.currentPage + delta);
      if (max) next = Math.min(next, max);
      const done = max > 0 && next >= max;
      return {
        ...b,
        currentPage: next,
        status: done ? 'completed' : b.status,
        completedDate: done ? todayISO() : b.completedDate,
      };
    }));
  };

  const setProgressExact = (book: Book, value: number) => {
    setBooks(books.map(b => {
      if (b.id !== book.id) return b;
      const max = b.totalPages || 0;
      let next = Math.max(0, value);
      if (max) next = Math.min(next, max);
      const done = max > 0 && next >= max;
      return { ...b, currentPage: next, status: done ? 'completed' : b.status, completedDate: done ? todayISO() : b.completedDate };
    }));
  };

  const markCompleted = (book: Book) => {
    setBooks(books.map(b => b.id === book.id
      ? { ...b, status: 'completed', currentPage: b.totalPages || b.currentPage, completedDate: todayISO() }
      : b));
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBookId || !noteText.trim()) return;
    setBooks(books.map(b => b.id === noteBookId
      ? {
          ...b,
          notes: [
            { id: Date.now().toString(), type: noteType, text: noteText.trim(), page: notePage ? parseInt(notePage) : undefined, createdAt: todayISO() },
            ...b.notes,
          ],
        }
      : b));
    setNoteText('');
    setNotePage('');
  };

  const deleteNote = (bookId: string, noteId: string) => {
    setBooks(books.map(b => b.id === bookId ? { ...b, notes: b.notes.filter(n => n.id !== noteId) } : b));
  };

  // Derived
  const ownedBooks = books.filter(b => b.status !== 'wishlist');
  const readingBooks = books.filter(b => b.status === 'reading');
  const completedBooks = books.filter(b => b.status === 'completed');
  const wishlistBooks = books.filter(b => b.status === 'wishlist');

  const currentYear = new Date().getFullYear();
  const pagesReadThisYear =
    completedBooks
      .filter(b => b.completedDate && new Date(b.completedDate).getFullYear() === currentYear)
      .reduce((s, b) => s + (b.totalPages || 0), 0) +
    readingBooks.reduce((s, b) => s + (b.currentPage || 0), 0);

  const totalNotes = books.reduce((s, b) => s + b.notes.length, 0);

  const progressPct = (b: Book) => (b.totalPages > 0 ? Math.min(100, Math.round((b.currentPage / b.totalPages) * 100)) : 0);

  const matchesSearch = (b: Book) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [b.title, b.author, b.category].some(f => f.toLowerCase().includes(q));
  };

  // Completed grouped by year (newest year first)
  const completedByYear = (() => {
    const map: Record<string, Book[]> = {};
    completedBooks.forEach(b => {
      const y = b.completedDate ? String(new Date(b.completedDate).getFullYear()) : 'Tidak diketahui';
      (map[y] = map[y] || []).push(b);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  })();

  // Yearly completed counts for the stats chart
  const yearlyStats = (() => {
    const map: Record<string, number> = {};
    completedBooks.forEach(b => {
      if (!b.completedDate) return;
      const y = String(new Date(b.completedDate).getFullYear());
      map[y] = (map[y] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  })();
  const maxYearCount = Math.max(1, ...yearlyStats.map(([, c]) => c));

  const TABS: { key: Tab; label: string; Icon: React.ElementType; count?: number }[] = [
    { key: 'dashboard', label: t('Papan', 'Board'), Icon: LayoutDashboard },
    { key: 'library', label: t('Koleksi', 'Library'), Icon: Library, count: ownedBooks.length },
    { key: 'reading', label: t('Baca', 'Reading'), Icon: BookOpen, count: readingBooks.length },
    { key: 'completed', label: t('Selesai', 'Finished'), Icon: CheckCircle, count: completedBooks.length },
    { key: 'wishlist', label: t('Hajat', 'Wishlist'), Icon: Bookmark, count: wishlistBooks.length },
    { key: 'notes', label: t('Nota', 'Notes'), Icon: Quote, count: totalNotes },
    { key: 'stats', label: t('Statistik', 'Stats'), Icon: BarChart3 },
  ];

  const inputCls = 'w-full px-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all';
  const labelCls = 'block text-xs font-bold text-muted uppercase tracking-wider mb-2';

  // ── Cover thumbnail ──────────────────────────────────────────
  const Cover = ({ book, size = 'md' }: { book: Book; size?: 'sm' | 'md' }) => {
    const dim = size === 'sm' ? 'w-12 h-16' : 'w-14 h-20';
    if (book.cover) {
      return <img src={book.cover} alt={book.title} className={`${dim} object-cover rounded-lg shrink-0 shadow-md`} />;
    }
    return (
      <div className={`${dim} rounded-lg shrink-0 bg-gradient-to-br from-violet-500/30 to-violet-700/30 border border-violet-500/20 flex items-center justify-center text-violet-400`}>
        <BookMarked size={size === 'sm' ? 18 : 22} />
      </div>
    );
  };

  // ── Book row (Library / Wishlist) ────────────────────────────
  const BookRow = ({ book }: { book: Book }) => {
    const meta = STATUS_META[book.status];
    const pct = progressPct(book);
    return (
      <div className="glass-panel p-3 flex gap-3 group transition-all hover:border-violet-500/30">
        <div className="cursor-pointer" onClick={() => handleEdit(book)}>
          <Cover book={book} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 cursor-pointer" onClick={() => handleEdit(book)}>
              <h3 className="font-bold text-text truncate leading-tight">{book.title}</h3>
              <p className="text-xs text-muted truncate mt-0.5">{book.author || t('Penulis tidak diketahui', 'Author not recorded')}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => handleEdit(book)} aria-label={t('Sunting', 'Edit')} className="p-1.5 text-muted hover:text-violet-500 bg-text/5 hover:bg-violet-500/10 rounded-lg transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }} aria-label={t('Padam', 'Delete')} className="p-1.5 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {t(meta.ms, meta.en)}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-text/5 text-[11px] font-medium text-text/70">{catLabel(book.category)}</span>
            {book.totalPages > 0 && (
              <span className="text-[11px] text-muted flex items-center gap-1"><Hash size={11} />{book.totalPages}p</span>
            )}
          </div>
          {book.status === 'reading' && book.totalPages > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full bg-text/10 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[11px] text-muted mt-1">{book.currentPage} / {book.totalPages} · {pct}%</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, title, sub, cta, onCta }: { icon: React.ElementType; title: string; sub: string; cta?: string; onCta?: () => void }) => (
    <div className="glass-panel p-10 text-center flex flex-col items-center">
      <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center text-violet-500 mb-4">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
      <p className="text-sm text-muted mb-6 max-w-xs mx-auto">{sub}</p>
      {cta && (
        <button onClick={onCta} className="px-6 py-3 bg-violet-500 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-violet-500/30 transition-all hover:-translate-y-0.5">
          <Plus size={20} /> {cta}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/15 text-violet-500 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text leading-tight">My Books</h1>
            <p className="text-sm text-muted">{t('Rekod bacaan, senarai hajat & petikan', 'Reading list, wishlist and quotes')}</p>
          </div>
        </div>
        {!isAdding && (
          <button
            onClick={() => openAdd()}
            aria-label={t('Tambah buku', 'Add a book')}
            className="w-10 h-10 rounded-full bg-violet-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-violet-500/20 shrink-0"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {/* Tabs */}
      {!isAdding && (
        <div className="grid grid-cols-4 gap-1 p-1 bg-text/5 rounded-xl">
          {TABS.map(({ key, label, Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2.5 px-1 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
                activeTab === key ? 'bg-surface text-violet-400 shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={18} />
              <span className="whitespace-nowrap leading-none">
                {label}{typeof count === 'number' ? <span className="opacity-70"> {count}</span> : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {isAdding ? (
        /* ── Add / Edit form ───────────────────────────────── */
        <div className="glass-panel p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-text">
              <Plus className="text-violet-500" />
              {editingBook ? t('Sunting Buku', 'Edit Book') : t('Tambah Buku', 'Add Book')}
            </h2>
            <button onClick={resetForm} aria-label={t('Tutup', 'Close')} className="p-2 bg-text/5 hover:bg-text/10 text-muted rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className={labelCls}>{t('Tajuk', 'Title')} *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted"><Tag size={18} /></div>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls + ' pl-10'} placeholder={t('cth. Atomic Habits', 'e.g. Atomic Habits')} />
              </div>
            </div>

            <div>
              <label className={labelCls}>{t('Penulis', 'Author')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted"><User size={18} /></div>
                <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls + ' pl-10'} placeholder={t('cth. James Clear', 'e.g. James Clear')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider">{t('Kategori', 'Category')}</label>
                  {customCategories.includes(category) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(trs(`Padam kategori sendiri "${category}"?`, `Delete the custom category "${category}"?`))) {
                          setCustomCategories(customCategories.filter(c => c !== category));
                          setCategory(CATEGORIES[0]);
                        }
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                    >{t('Padam', 'Delete')}</button>
                  )}
                </div>
                {category === ADD_OWN() ? (
                  <input
                    type="text"
                    autoFocus
                    placeholder={t('Kategori baru...', 'New category...')}
                    className={inputCls}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && !CATEGORIES.includes(val) && !customCategories.includes(val)) {
                        setCustomCategories([...customCategories, val]);
                        setCategory(val);
                      } else if (val) setCategory(val);
                      else setCategory(CATEGORIES[0]);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                  />
                ) : (
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls + ' appearance-none'}>
                    {[...CATEGORIES, ...customCategories].map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                    <option value={ADD_OWN()}>{ADD_OWN()}</option>
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls}>{t('Jumlah Muka Surat', 'Total Pages')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted"><Hash size={18} /></div>
                  <input type="number" min="0" value={totalPages} onChange={(e) => setTotalPages(e.target.value)} className={inputCls + ' pl-10'} placeholder={t('cth. 320', 'e.g. 320')} />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t('Status', 'Status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as BookStatus)} className={inputCls + ' appearance-none'}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(s.ms, s.en)}</option>)}
              </select>
            </div>

            {!editingBook && (
              <div>
                <label className={labelCls}>{t('Nota / Petikan (pilihan)', 'Note / Quote (optional)')}</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 flex items-start pointer-events-none text-muted"><FileText size={18} /></div>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className={inputCls + ' pl-10 min-h-[70px]'} placeholder={t('Fikiran atau petikan untuk diingat...', 'A thought or quote worth keeping...')} />
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>{t('Gambar Kulit (pilihan)', 'Cover Image (optional)')}</label>
              {cover ? (
                <div className="relative inline-block">
                  <img src={cover} alt={t('Kulit buku', 'Book cover')} className="w-28 h-40 object-cover rounded-xl border border-text/10 shadow-md" />
                  <button type="button" onClick={() => { setCover(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-full border-2 border-dashed border-text/20 rounded-xl p-6 flex flex-col items-center justify-center text-muted hover:text-violet-500 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={24} className="mb-2" />
                  <span className="text-sm font-medium">{t('Tekan untuk tambah kulit', 'Tap to add a cover')}</span>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                </div>
              )}
            </div>

            <button type="submit" className="w-full py-4 bg-violet-500 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <CheckCircle size={20} />
              {editingBook ? t('Simpan Perubahan', 'Save Changes') : t('Tambah Buku', 'Add Book')}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* ── Dashboard ──────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t('Buku Dimiliki', 'Books Owned'), value: ownedBooks.length, Icon: Library, cls: 'text-violet-500 bg-violet-500/15', emoji: '📚' },
                  { label: t('Sedang Baca', 'Reading'), value: readingBooks.length, Icon: BookOpen, cls: 'text-blue-500 bg-blue-500/15', emoji: '📖' },
                  { label: t('Selesai', 'Finished'), value: completedBooks.length, Icon: CheckCircle, cls: 'text-emerald-500 bg-emerald-500/15', emoji: '✅' },
                  { label: t('Senarai Hajat', 'Wishlist'), value: wishlistBooks.length, Icon: Bookmark, cls: 'text-rose-500 bg-rose-500/15', emoji: '⏳' },
                ].map(s => (
                  <div key={s.label} className="glass-panel p-4 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${s.cls}`}><s.Icon size={22} /></div>
                    <div className="min-w-0">
                      <div className="text-2xl font-black text-text leading-none">{s.value}</div>
                      <div className="text-xs text-muted mt-1">{s.emoji} {s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pages read this year */}
              <div className="glass-panel p-6 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-violet-500/15 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-muted mb-1">
                    <Target size={16} className="text-violet-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t(`Muka Surat Dibaca ${currentYear}`, `Pages Read in ${currentYear}`)}</span>
                  </div>
                  <div className="text-4xl font-black text-text">{pagesReadThisYear.toLocaleString()}</div>
                  <div className="text-xs text-muted mt-1">
                    {t(`${completedBooks.filter(b => b.completedDate && new Date(b.completedDate).getFullYear() === currentYear).length} selesai · ${readingBooks.length} sedang dibaca`, `${completedBooks.filter(b => b.completedDate && new Date(b.completedDate).getFullYear() === currentYear).length} finished · ${readingBooks.length} reading`)}
                  </div>
                </div>
              </div>

              {/* Continue reading */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-4 text-violet-500">
                  <BookOpen size={20} />
                  <h3 className="font-bold text-lg text-text">{t('Sambung Baca', 'Keep Reading')}</h3>
                </div>
                {readingBooks.length > 0 ? (
                  <div className="space-y-3">
                    {readingBooks.slice(0, 3).map(book => (
                      <div key={book.id} onClick={() => setActiveTab('reading')} className="p-3 rounded-xl bg-surface border border-violet-500/20 flex gap-3 cursor-pointer hover:bg-violet-500/5 transition-colors">
                        <Cover book={book} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-text truncate">{book.title}</div>
                          <div className="text-xs text-muted truncate">{book.author}</div>
                          <div className="h-1.5 w-full bg-text/10 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${progressPct(book)}%` }} />
                          </div>
                          <div className="text-[11px] text-muted mt-1">{book.currentPage}/{book.totalPages || '?'} · {progressPct(book)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted bg-surface/50 rounded-xl border border-dashed border-text/10">
                    <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-sm">{t('Tiada buku sedang dibaca.', 'No book on the go.')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Library ────────────────────────────────────── */}
          {activeTab === 'library' && (
            <div className="space-y-4 animate-fade-in">
              {ownedBooks.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted"><Search size={18} /></div>
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari koleksi anda...', 'Search your library...')} className={inputCls + ' pl-10'} />
                </div>
              )}
              {ownedBooks.length === 0 ? (
                <EmptyState icon={Library} title={t('Koleksi anda kosong', 'Your library is empty')} sub={t('Tambah buku yang anda miliki untuk rekod kemajuan bacaan.', 'Add the books you own to track your reading progress.')} cta={t('Tambah Buku Pertama', 'Add Your First Book')} onCta={() => openAdd('to-read')} />
              ) : ownedBooks.filter(matchesSearch).length === 0 ? (
                <div className="glass-panel p-8 text-center text-muted"><Search size={28} className="mx-auto mb-2 opacity-50" /><p className="text-sm font-medium">Tiada buku sepadan “{search}”.</p></div>
              ) : (
                ownedBooks.filter(matchesSearch).map(b => <BookRow key={b.id} book={b} />)
              )}
            </div>
          )}

          {/* ── Currently Reading ──────────────────────────── */}
          {activeTab === 'reading' && (
            <div className="space-y-4 animate-fade-in">
              {readingBooks.length === 0 ? (
                <EmptyState icon={BookOpen} title={t('Tiada bacaan sedang berjalan', 'Nothing on the go')} sub={t("Tanda buku sebagai 'Sedang Dibaca' untuk rekod muka surat di sini.", "Mark a book as 'Reading' to track its pages here.")} cta={t('Tambah Buku', 'Add a Book')} onCta={() => openAdd('reading')} />
              ) : (
                readingBooks.map(book => {
                  const pct = progressPct(book);
                  return (
                    <div key={book.id} className="glass-panel p-4">
                      <div className="flex gap-3">
                        <Cover book={book} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 cursor-pointer" onClick={() => handleEdit(book)}>
                              <h3 className="font-bold text-text truncate leading-tight">{book.title}</h3>
                              <p className="text-xs text-muted truncate mt-0.5">{book.author || t('Penulis tidak diketahui', 'Author not recorded')}</p>
                            </div>
                            <button onClick={() => handleDelete(book.id)} aria-label={t('Padam', 'Delete')} className="p-1.5 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0">
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-2xl font-black text-violet-500">{pct}%</span>
                            <span className="text-xs text-muted">siap</span>
                          </div>
                        </div>
                      </div>

                      {/* progress bar + exact input */}
                      <div className="mt-3 h-2 w-full bg-text/10 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted">
                          <input
                            type="number"
                            min="0"
                            max={book.totalPages || undefined}
                            value={book.currentPage}
                            onChange={(e) => setProgressExact(book, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-surface border border-text/10 rounded-lg text-text text-center focus:outline-none focus:border-violet-500/50"
                          />
                          <span>/ {book.totalPages || '?'} {t('muka surat', 'pages')}</span>
                        </div>
                        <button onClick={() => markCompleted(book)} className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 font-bold hover:bg-emerald-500/25 transition-colors flex items-center gap-1">
                          <CheckCircle size={14} /> {t('Habiskan', 'Finish it')}
                        </button>
                      </div>

                      {/* quick add buttons */}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[5, 10, 25].map(n => (
                          <button key={n} onClick={() => updateProgress(book, n)} className="py-2.5 rounded-xl bg-violet-500/10 text-violet-500 font-bold text-sm hover:bg-violet-500/20 active:scale-95 transition-all">
                            +{n} {t('Muka Surat', 'Pages')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Completed (by year) ────────────────────────── */}
          {activeTab === 'completed' && (
            <div className="space-y-6 animate-fade-in">
              {completedBooks.length === 0 ? (
                <EmptyState icon={CheckCircle} title={t('Belum ada buku selesai', 'No finished books yet')} sub={t('Buku yang anda habiskan akan disimpan di sini, mengikut tahun.', 'The books you finish are filed here, by year.')} />
              ) : (
                completedByYear.map(([year, list]) => (
                  <div key={year}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-lg text-text">{year}</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold">{t(`${list.length} selesai`, `${list.length} finished`)}</span>
                    </div>
                    <div className="space-y-3">
                      {list.map(b => <BookRow key={b.id} book={b} />)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Wishlist ───────────────────────────────────── */}
          {activeTab === 'wishlist' && (
            <div className="space-y-4 animate-fade-in">
              {wishlistBooks.length === 0 ? (
                <EmptyState icon={Bookmark} title={t('Senarai hajat kosong', 'Your wishlist is empty')} sub={t('Simpan buku yang anda nak beli atau baca seterusnya.', 'Save the books you want to buy or read next.')} cta={t('Tambah ke Senarai Hajat', 'Add to Wishlist')} onCta={() => openAdd('wishlist')} />
              ) : (
                wishlistBooks.map(b => <BookRow key={b.id} book={b} />)
              )}
            </div>
          )}

          {/* ── Notes & Quotes ─────────────────────────────── */}
          {activeTab === 'notes' && (
            <div className="space-y-5 animate-fade-in">
              {books.length === 0 ? (
                <EmptyState icon={Quote} title={t('Tiada buku untuk dinotakan', 'No book to take notes on')} sub={t('Tambah buku dahulu, kemudian simpan petikan dan nota daripadanya.', 'Add a book first, then save quotes and notes from it.')} cta={t('Tambah Buku', 'Add a Book')} onCta={() => openAdd()} />
              ) : (
                <>
                  {/* add note form */}
                  <form onSubmit={addNote} className="glass-panel p-4 space-y-3">
                    <h3 className="font-bold text-text flex items-center gap-2"><Quote size={18} className="text-violet-500" /> {t('Tambah Petikan / Nota', 'Add a Quote / Note')}</h3>
                    <select value={noteBookId} onChange={(e) => setNoteBookId(e.target.value)} className={inputCls + ' appearance-none'} required>
                      <option value="">{t('Pilih buku…', 'Choose a book…')}</option>
                      {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={noteType} onChange={(e) => setNoteType(e.target.value as 'quote' | 'note')} className={inputCls + ' appearance-none'}>
                        <option value="quote">{t('Petikan', 'Quote')}</option>
                        <option value="note">{t('Nota', 'Note')}</option>
                      </select>
                      <input type="number" min="0" value={notePage} onChange={(e) => setNotePage(e.target.value)} placeholder={t('Muka surat', 'Page')} className={inputCls} />
                    </div>
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t('Taip petikan atau nota…', 'Type the quote or note…')} className={inputCls + ' min-h-[70px]'} required />
                    <button type="submit" className="w-full py-3 bg-violet-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-violet-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                      <Plus size={18} /> {t('Simpan', 'Save')}
                    </button>
                  </form>

                  {/* notes list grouped by book */}
                  {totalNotes === 0 ? (
                    <div className="text-center py-8 text-muted bg-surface/50 rounded-xl border border-dashed border-text/10">
                      <Quote size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-sm">{t('Tiada petikan disimpan lagi.', 'No quotes saved yet.')}</p>
                    </div>
                  ) : (
                    books.filter(b => b.notes.length > 0).map(book => (
                      <div key={book.id} className="glass-panel p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Cover book={book} size="sm" />
                          <div className="min-w-0">
                            <h4 className="font-bold text-text truncate">{book.title}</h4>
                            <p className="text-xs text-muted truncate">{book.author}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {book.notes.map(n => (
                            <div key={n.id} className="group relative p-3 rounded-xl bg-surface border border-text/10">
                              <div className="flex items-start gap-2">
                                {n.type === 'quote'
                                  ? <Quote size={16} className="text-violet-500 shrink-0 mt-0.5" />
                                  : <FileText size={16} className="text-muted shrink-0 mt-0.5" />}
                                <p className={`text-sm flex-1 ${n.type === 'quote' ? 'italic text-text/90' : 'text-text/80'}`}>
                                  {n.type === 'quote' ? `“${n.text}”` : n.text}
                                </p>
                                <button onClick={() => deleteNote(book.id, n.id)} aria-label={t('Padam nota', 'Delete note')} className="p-1 text-muted hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {typeof n.page === 'number' && <div className="text-[11px] text-muted mt-1 pl-6">{t('Muka surat', 'Page')} {n.page}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Stats ──────────────────────────────────────── */}
          {activeTab === 'stats' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-4">
                  <div className="text-xs text-muted font-bold uppercase tracking-wider mb-1">{t('Jumlah Selesai', 'Total Finished')}</div>
                  <div className="text-3xl font-black text-text">{completedBooks.length}</div>
                </div>
                <div className="glass-panel p-4">
                  <div className="text-xs text-muted font-bold uppercase tracking-wider mb-1">{t('Muka Surat Keseluruhan', 'Total Pages')}</div>
                  <div className="text-3xl font-black text-text">{completedBooks.reduce((s, b) => s + (b.totalPages || 0), 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-5 text-violet-500">
                  <BarChart3 size={20} />
                  <h3 className="font-bold text-lg text-text">{t('Buku Selesai Ikut Tahun', 'Books Finished by Year')}</h3>
                </div>
                {yearlyStats.length === 0 ? (
                  <div className="text-center py-8 text-muted bg-surface/50 rounded-xl border border-dashed border-text/10">
                    <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-sm">{t('Habiskan sebuah buku untuk lihat statistik anda.', 'Finish a book to see your stats.')}</p>
                  </div>
                ) : (
                  <div className="flex items-end justify-around gap-3 h-56 pt-4">
                    {yearlyStats.map(([year, count]) => (
                      <div key={year} className="flex flex-col items-center justify-end flex-1 h-full">
                        <span className="text-sm font-black text-text mb-1">{count}</span>
                        {/* stacked-books bar */}
                        <div className="flex flex-col-reverse items-center gap-0.5 w-full" style={{ height: `${(count / maxYearCount) * 100}%`, minHeight: '12px' }}>
                          {Array.from({ length: count }).map((_, i) => (
                            <div
                              key={i}
                              className="w-full max-w-[44px] rounded-[3px] bg-gradient-to-r from-violet-500 to-violet-400 shadow-sm border-b border-violet-700/40 flex-1"
                              title={`${year}: buku ${i + 1}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted mt-2 font-medium">{year}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-center text-[11px] text-muted mt-4 flex items-center justify-center gap-1">
                  <Star size={11} className="text-violet-500" /> Setiap blok ialah satu buku selesai
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
