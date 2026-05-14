/* MC-JACOB GLOBAL FARMS - Cart Management */

const Cart = {
  storageKey: 'mcj_cart',

  get items() {
    try { return JSON.parse(localStorage.getItem(this.storageKey)) || []; }
    catch { return []; }
  },

  save(items) {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.updateCartBadge();
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: this.count } }));
  },

  get count() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  get total() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  add(product, quantity = 1) {
    const items = this.items;
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.image,
        bundle_size: product.bundle_size,
        bundle_unit: product.bundle_unit,
        net_weight: product.net_weight,
        min_order: product.min_order || 1,
        quantity
      });
    }
    this.save(items);
    Toast.success(`${product.name} added to cart!`, 'Added to Cart');
  },

  remove(productId) {
    const items = this.items.filter(i => i.id !== productId);
    this.save(items);
  },

  updateQty(productId, quantity) {
    const items = this.items;
    const item = items.find(i => i.id === productId);
    if (!item) return;
    const minQty = item.min_order || 1;
    if (quantity < minQty) {
      Toast.warning(`Minimum order is ${minQty} ${item.bundle_unit}(s)`);
      return;
    }
    item.quantity = quantity;
    this.save(items);
  },

  clear() {
    localStorage.removeItem(this.storageKey);
    this.updateCartBadge();
  },

  updateCartBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = this.count;
    badges.forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  renderCartPage() {
    const container = document.getElementById('cart-items-list');
    const emptyState = document.getElementById('cart-empty');
    const cartContent = document.getElementById('cart-content');
    if (!container) return;

    const items = this.items;
    if (items.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (cartContent) cartContent.style.display = 'none';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (cartContent) cartContent.style.display = 'grid';

    container.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-img">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '🌿'}
        </div>
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-bundle">
            ${item.bundle_size} units/${item.bundle_unit} · ${item.net_weight || ''}
          </div>
          <div class="quantity-control">
            <button class="qty-btn" onclick="Cart.changeQty(${item.id}, -1)">−</button>
            <span class="qty-display">${item.quantity}</span>
            <button class="qty-btn" onclick="Cart.changeQty(${item.id}, 1)">+</button>
            <span style="font-size:12px;color:var(--gray);margin-left:6px">${item.bundle_unit}s</span>
          </div>
        </div>
        <div style="text-align:right">
          <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
          <div style="font-size:12px;color:var(--gray);margin-bottom:8px">${formatCurrency(item.price)}/bundle</div>
          <button class="cart-remove" onclick="Cart.removeItem(${item.id})" title="Remove">🗑️</button>
        </div>
      </div>
    `).join('');

    this.renderSummary();
  },

  renderSummary() {
    const subtotal = this.total;
    document.getElementById('cart-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('cart-total').textContent = formatCurrency(subtotal + 2500);
    document.getElementById('cart-items-count').textContent = this.count;
  },

  changeQty(id, delta) {
    const items = this.items;
    const item = items.find(i => i.id === id);
    if (!item) return;
    const minQty = item.min_order || 1;
    const newQty = item.quantity + delta;
    if (newQty < minQty) {
      if (confirm(`Remove ${item.name} from cart?`)) { this.removeItem(id); }
      return;
    }
    item.quantity = newQty;
    this.save(items);
    this.renderCartPage();
  },

  removeItem(id) {
    this.remove(id);
    this.renderCartPage();
    Toast.info('Item removed from cart');
  }
};

// Init cart badge on page load
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateCartBadge();
});
