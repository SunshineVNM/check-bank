const authGate = document.getElementById('authGate');
const appMain = document.getElementById('appMain');
const authForm = document.getElementById('authForm');
const accessSecretInput = document.getElementById('accessSecret');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const bankSearch = document.getElementById('bankSearch');
const bankCode = document.getElementById('bankCode');
const bankListEl = document.getElementById('bankList');
const bankToggle = document.getElementById('bankToggle');
const bankSelect = document.getElementById('bankSelect');
const form = document.getElementById('lookupForm');
const accountInput = document.getElementById('account');
const submitBtn = document.getElementById('submitBtn');
const resultEl = document.getElementById('result');

let banks = [];
let supportedBanks = [];
let activeIndex = -1;
let dropdownOpen = false;
let selectedBank = null;

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function bankLabel(bank) {
  return `${bank.code} — ${bank.short_name}`;
}

function getSupportedBanks() {
  return banks.filter((b) => b.lookup_supported === 1);
}

function filterBanks(query, limit = null) {
  const q = normalize(query.trim());
  let list = supportedBanks;
  if (q) {
    list = list.filter(
      (b) =>
        normalize(b.name).includes(q) ||
        normalize(b.short_name).includes(q) ||
        normalize(b.code).includes(q) ||
        String(b.bin).includes(q)
    );
  }
  return limit ? list.slice(0, limit) : list;
}

function setDropdownOpen(open) {
  dropdownOpen = open;
  bankSearch.setAttribute('aria-expanded', String(open));
  bankToggle.classList.toggle('open', open);
  if (!open) bankListEl.classList.add('hidden');
}

function renderBankOption(bank) {
  const li = document.createElement('li');
  li.role = 'option';
  li.dataset.code = bank.code;
  li.innerHTML = `
    <img src="${bank.icon_url || bank.logo_url}" alt="" onerror="this.style.display='none'" />
    <div class="bank-meta">
      <div class="bank-name">${bank.short_name}</div>
      <div class="bank-code">${bank.code} · ${bank.name}</div>
    </div>
  `;
  li.addEventListener('mousedown', (e) => {
    e.preventDefault();
    selectBank(bank);
  });
  return li;
}

function showDropdown(items) {
  bankListEl.innerHTML = '';
  if (!items.length) {
    bankListEl.innerHTML = '<li class="empty">Không tìm thấy ngân hàng</li>';
    bankListEl.classList.remove('hidden');
    setDropdownOpen(true);
    return;
  }
  items.forEach((b) => bankListEl.appendChild(renderBankOption(b)));
  bankListEl.classList.remove('hidden');
  setDropdownOpen(true);
  activeIndex = -1;
}

function selectBank(bank, { focusAccount = true } = {}) {
  selectedBank = bank;
  bankCode.value = bank.code;
  bankSearch.value = bankLabel(bank);
  bankSelect.value = bank.code;
  setDropdownOpen(false);

  if (focusAccount) accountInput.focus();
}

function clearSelection() {
  selectedBank = null;
  bankCode.value = '';
  bankSelect.value = '';
}

function populateSelect() {
  bankSelect.innerHTML = '<option value="">— Chọn ngân hàng —</option>';
  supportedBanks.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.code;
    opt.textContent = bankLabel(b);
    bankSelect.appendChild(opt);
  });
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.querySelector('.btn-text').classList.toggle('hidden', loading);
  submitBtn.querySelector('.spinner').classList.toggle('hidden', !loading);
}

function showResult(html, className) {
  resultEl.className = `result ${className}`;
  resultEl.innerHTML = html;
  resultEl.classList.remove('hidden');
}

function showApp(authenticated) {
  authGate.classList.toggle('hidden', authenticated);
  appMain.classList.toggle('hidden', !authenticated);
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status');
    const json = await res.json();
    if (json.authenticated) {
      showApp(true);
      loadBanks();
    } else {
      showApp(false);
      accessSecretInput.focus();
    }
  } catch {
    showApp(false);
  }
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: accessSecretInput.value }),
    });
    const json = await res.json();

    if (res.ok && json.success) {
      accessSecretInput.value = '';
      showApp(true);
      loadBanks();
    } else {
      authError.textContent = json.msg || 'Mã không đúng.';
      authError.classList.remove('hidden');
    }
  } catch {
    authError.textContent = 'Lỗi kết nối.';
    authError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  showApp(false);
  accessSecretInput.focus();
});

async function loadBanks() {
  try {
    const res = await fetch('/api/banks');
    if (res.status === 401) {
      showApp(false);
      return;
    }
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      banks = json.data.sort((a, b) =>
        a.short_name.localeCompare(b.short_name, 'vi')
      );
      supportedBanks = getSupportedBanks();
      populateSelect();
    }
  } catch {
    bankSearch.placeholder = 'Không tải được danh sách ngân hàng';
  }
}

bankSearch.addEventListener('input', () => {
  const query = bankSearch.value;
  if (selectedBank && query !== bankLabel(selectedBank)) {
    clearSelection();
  }
  showDropdown(filterBanks(query));
});

bankSearch.addEventListener('focus', () => {
  if (selectedBank) {
    bankSearch.select();
  }
  showDropdown(filterBanks(bankSearch.value));
});

bankSearch.addEventListener('keydown', (e) => {
  const items = bankListEl.querySelectorAll('li[role="option"]');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
  } else if (e.key === 'Enter') {
    if (activeIndex >= 0) {
      e.preventDefault();
      const code = items[activeIndex].dataset.code;
      const bank = supportedBanks.find((b) => b.code === code);
      if (bank) selectBank(bank);
    }
    return;
  } else if (e.key === 'Escape') {
    setDropdownOpen(false);
    return;
  } else {
    return;
  }

  items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
  items[activeIndex]?.scrollIntoView({ block: 'nearest' });
});

bankToggle.addEventListener('click', () => {
  if (dropdownOpen) {
    setDropdownOpen(false);
  } else {
    bankSearch.focus();
    showDropdown(filterBanks(bankSearch.value));
  }
});

bankSelect.addEventListener('change', () => {
  const code = bankSelect.value;
  if (!code) {
    clearSelection();
    bankSearch.value = '';
    bankSearch.focus();
    return;
  }
  const bank = supportedBanks.find((b) => b.code === code);
  if (bank) selectBank(bank);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.bank-combobox')) {
    setDropdownOpen(false);
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultEl.classList.add('hidden');

  const bank = bankCode.value;
  const account = accountInput.value.trim();

  if (!bank) {
    showResult('Vui lòng chọn ngân hàng (tìm kiếm hoặc chọn nhanh).', 'error');
    bankSearch.focus();
    return;
  }

  setLoading(true);

  try {
    const res = await fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank, account }),
    });
    const json = await res.json();

    if (res.status === 401) {
      showApp(false);
      return;
    }

    if (json.success && json.data) {
      const d = json.data;
      showResult(
        `
        <div class="owner-name">${d.ownerName || '—'}</div>
        <dl>
          <div class="row"><dt>Chủ tài khoản</dt><dd>${d.ownerName || '—'}</dd></div>
          <div class="row"><dt>Ngân hàng</dt><dd>${d.bank || bank}</dd></div>
          <div class="row"><dt>Số tài khoản</dt><dd>${d.account || account}</dd></div>
        </dl>
        `,
        'success'
      );
    } else {
      showResult(json.msg || 'Tra cứu thất bại.', 'error');
    }
  } catch (err) {
    showResult(err.message || 'Lỗi kết nối.', 'error');
  } finally {
    setLoading(false);
  }
});

checkAuth();
