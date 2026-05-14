/* MC-JACOB GLOBAL FARMS - Main App JS */

const API = {
  base: '/api',
  get token() { return localStorage.getItem('mcj_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('mcj_user')); } catch { return null; } },

  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async get(endpoint) {
    const res = await fetch(this.base + endpoint, { headers: this.headers() });
    return res.json();
  },

  async post(endpoint, data) {
    const res = await fetch(this.base + endpoint, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(data)
    });
    return res.json();
  },

  async put(endpoint, data) {
    const res = await fetch(this.base + endpoint, {
      method: 'PUT', headers: this.headers(), body: JSON.stringify(data)
    });
    return res.json();
  },

  async postForm(endpoint, formData) {
    const res = await fetch(this.base + endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData
    });
    return res.json();
  },

  async delete(endpoint) {
    const res = await fetch(this.base + endpoint, {
      method: 'DELETE', headers: this.headers()
    });
    return res.json();
  }
};

// Toast notifications
const Toast = {
  container: null,
  init() {
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toast-container');
    }
  },
  show(message, type = 'info', title = '') {
    this.init();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Notice' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-body">
        <div class="toast-title">${title || titles[type]}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },
  success(msg, title) { this.show(msg, 'success', title); },
  error(msg, title) { this.show(msg, 'error', title); },
  warning(msg, title) { this.show(msg, 'warning', title); },
  info(msg, title) { this.show(msg, 'info', title); }
};

// Format currency
function formatCurrency(amount) {
  return '₦' + parseFloat(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Auth helpers
function isLoggedIn() { return !!API.token && !!API.user; }
function isAdmin() { return isLoggedIn() && API.user.role === 'admin'; }
function isDealer() { return isLoggedIn() && API.user.role === 'dealer'; }

function requireAuth(redirectUrl = '/login.html') {
  if (!isLoggedIn()) { window.location.href = redirectUrl; return false; }
  return true;
}

function requireAdmin(redirectUrl = '/login.html') {
  if (!isAdmin()) { window.location.href = redirectUrl; return false; }
  return true;
}

function logout() {
  localStorage.removeItem('mcj_token');
  localStorage.removeItem('mcj_user');
  window.location.href = '/login.html';
}

// Update navbar UI
function updateNavbar() {
  const loginLink = document.getElementById('nav-login');
  const userMenu = document.getElementById('nav-user-menu');
  const dashboardLink = document.getElementById('nav-dashboard');

  if (isLoggedIn()) {
    const user = API.user;
    if (loginLink) loginLink.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      const nameEl = userMenu.querySelector('.user-name');
      if (nameEl) nameEl.textContent = user.full_name.split(' ')[0];
    }
    if (dashboardLink) {
      dashboardLink.href = isAdmin() ? '/admin/' : '/dashboard.html';
      dashboardLink.style.display = 'block';
    }
  } else {
    if (loginLink) loginLink.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
    if (dashboardLink) dashboardLink.style.display = 'none';
  }
}

// Status badge helper
function statusBadge(status, type = 'order') {
  const map = {
    pending: 'badge-warning', confirmed: 'badge-primary',
    processing: 'badge-info', shipped: 'badge-info',
    delivered: 'badge-success', cancelled: 'badge-danger',
    paid: 'badge-success', unpaid: 'badge-danger',
    pending_verification: 'badge-warning', refunded: 'badge-secondary',
    verified: 'badge-success', rejected: 'badge-danger',
    active: 'badge-success', inactive: 'badge-secondary', suspended: 'badge-danger'
  };
  const cls = map[status] || 'badge-secondary';
  const label = status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';
  return `<span class="badge ${cls}">${label}</span>`;
}

// Copy to clipboard
function copyText(text, feedback = '') {
  navigator.clipboard.writeText(text).then(() => {
    Toast.success(feedback || `Copied: ${text}`);
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    Toast.success(feedback || 'Copied!');
  });
}

// Loading state
function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.classList.add('btn-loading');
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.classList.remove('btn-loading');
    btn.disabled = false;
  }
}

// Debounce
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.navbar-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !nav.contains(e.target)) {
        nav.classList.remove('open');
      }
    });
  }

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  updateNavbar();
});

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

// Image preview for file inputs
function setupImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-height:180px;border-radius:8px;">`;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

// Nigerian states list
const NG_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara'
];

function populateStates(selectId, selectedValue = '') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Select State</option>' +
    NG_STATES.map(s => `<option value="${s}"${s === selectedValue ? ' selected' : ''}>${s}</option>`).join('');
}
