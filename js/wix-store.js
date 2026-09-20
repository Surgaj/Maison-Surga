(() => {
  const CLIENT_ID = '4a256781-4f9d-4ae4-a7f6-2bcb9589c2fb';
  const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
  const TOKEN_KEY = 'maisonSurgaWixVisitorV1';
  const API_ROOT = 'https://www.wixapis.com';

  const parseJson = async response => {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { raw: text }; }
  };

  const tokenState = () => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); }
    catch { return null; }
  };

  const saveTokens = data => {
    const expiresIn = Number(data.expires_in || data.expiresIn || 14400);
    const state = {
      accessToken: data.access_token || data.accessToken,
      refreshToken: data.refresh_token || data.refreshToken || null,
      expiresAt: Date.now() + Math.max(60, expiresIn - 90) * 1000
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(state));
    return state;
  };

  const tokenRequest = async body => {
    const response = await fetch(`${API_ROOT}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await parseJson(response);
    if (!response.ok) throw new Error(data.error_description || data.error || 'Unable to start Wix visitor session.');
    return saveTokens(data);
  };

  const getAccessToken = async () => {
    const state = tokenState();
    if (state?.accessToken && state.expiresAt > Date.now()) return state.accessToken;

    if (state?.refreshToken) {
      try {
        const refreshed = await tokenRequest({
          clientId: CLIENT_ID,
          grantType: 'refresh_token',
          refreshToken: state.refreshToken
        });
        return refreshed.accessToken;
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }

    const created = await tokenRequest({
      clientId: CLIENT_ID,
      grantType: 'anonymous'
    });
    return created.accessToken;
  };

  const api = async (path, options = {}, retry = true) => {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
        ...(options.headers || {})
      }
    });

    if (response.status === 401 && retry) {
      localStorage.removeItem(TOKEN_KEY);
      return api(path, options, false);
    }

    const data = await parseJson(response);
    if (!response.ok) {
      const message = data?.message || data?.details?.applicationError?.description || data?.error || `Wix request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  const getCurrentCart = async () => {
    try {
      const data = await api('/ecom/v2/carts/current');
      return data.cart || null;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  };

  const addToCart = async ({ productId, variantId, quantity = 1 }) => {
    const catalogReference = {
      catalogItemId: productId,
      appId: STORES_APP_ID
    };
    if (variantId) catalogReference.options = { variantId };

    const data = await api('/ecom/v2/carts/current/add-line-items', {
      method: 'POST',
      body: JSON.stringify({
        catalogItems: [{ catalogReference, quantity }]
      })
    });
    window.dispatchEvent(new CustomEvent('surga:cart-updated', { detail: data.cart }));
    return data.cart;
  };

  const getCheckoutUrl = async cartId => {
    const data = await api(`/ecom/v2/carts/${encodeURIComponent(cartId)}/get-checkout-url`, {
      method: 'POST',
      body: '{}'
    });
    return data.checkoutUrl;
  };

  const queryVariants = async productId => {
    const data = await api('/stores/v3/products/query-variants', {
      method: 'POST',
      body: JSON.stringify({
        fields: ['CURRENCY'],
        query: {
          filter: {
            'productData.productId': { '$eq': productId }
          }
        }
      })
    });
    return data.variants || [];
  };

  const lineItemCount = cart => (cart?.lineItems || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const money = value => {
    if (!value) return '';
    return value.formattedAmount || (value.amount ? `£${Number(value.amount).toFixed(2)}` : '');
  };

  const lineImage = item => {
    const media = item?.image || item?.media;
    return media?.url || media?.image?.url || item?.catalogReference?.image?.url || '';
  };

  const lineName = item => item?.productName?.original || item?.productName || item?.name || 'Maison Surga item';

  const renderBag = async () => {
    const panel = document.getElementById('bag-content');
    const countEl = document.querySelector('.bag-count');
    if (!panel) return;

    panel.innerHTML = '<div class="bag-loading">Loading your bag…</div>';

    try {
      const cart = await getCurrentCart();
      const count = lineItemCount(cart);
      if (countEl) countEl.textContent = `(${count})`;

      if (!cart || !count) {
        panel.innerHTML = `<div class="empty-bag">
          <p>Your beauty bag is empty.</p>
          <a class="button dark" href="product.html">Discover the facial cleansing edit <span>⟶</span></a>
        </div>`;
        return;
      }

      const lines = (cart.lineItems || []).map(item => {
        const image = lineImage(item);
        const price = money(item?.price?.amount ? item.price : item?.price);
        const description = (item?.descriptionLines || [])
          .map(line => line?.plainText?.original || line?.plainText || '')
          .filter(Boolean)
          .join(' · ');
        return `<article class="bag-line">
          ${image ? `<img src="${image}" alt="">` : '<div class="bag-line-placeholder"></div>'}
          <div>
            <strong>${lineName(item)}</strong>
            ${description ? `<small>${description}</small>` : ''}
            <small>Qty ${Number(item.quantity || 1)}</small>
          </div>
          <span>${price}</span>
        </article>`;
      }).join('');

      const subtotal = money(cart.subtotal);
      panel.innerHTML = `${lines}
        <div class="bag-summary">
          <div><span>Subtotal</span><strong>${subtotal || 'Calculated at checkout'}</strong></div>
          <button class="button dark bag-checkout" type="button">Continue to secure checkout <span>⟶</span></button>
          <small>Checkout and payment are securely handled by Wix.</small>
        </div>`;

      panel.querySelector('.bag-checkout')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const original = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Opening checkout…';
        try {
          const url = await getCheckoutUrl(cart.id);
          if (!url) throw new Error('Checkout URL was not returned.');
          location.href = url;
        } catch (error) {
          button.disabled = false;
          button.innerHTML = original;
          showNotice(error.message || 'Unable to open checkout.', 'error');
        }
      });
    } catch (error) {
      panel.innerHTML = '<p class="bag-error">We could not load your bag right now.</p>';
      console.error('[Maison Surga] bag error', error);
    }
  };

  const showNotice = (message, type = 'success') => {
    let notice = document.getElementById('store-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'store-notice';
      notice.className = 'store-notice';
      notice.setAttribute('role', 'status');
      document.body.appendChild(notice);
    }
    notice.className = `store-notice ${type}`;
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => { notice.hidden = true; }, 3200);
  };

  const initProductPage = async () => {
    const root = document.querySelector('[data-wix-product-id]');
    if (!root) return;

    const productId = root.dataset.wixProductId;
    const selector = document.getElementById('variant-options');
    const price = document.getElementById('product-price');
    const compare = document.getElementById('product-compare-price');
    const button = document.getElementById('add-to-bag');
    if (!selector || !button) return;

    button.disabled = true;
    button.textContent = 'Loading…';

    try {
      const variants = (await queryVariants(productId)).filter(v => v.visible !== false && v.inventoryStatus?.inStock !== false);
      if (!variants.length) throw new Error('This product is not available.');

      const colors = variants.map(variant => {
        const color = (variant.optionChoices || []).find(choice => choice.optionChoiceNames?.optionName === 'Color');
        return {
          variant,
          color: color?.optionChoiceNames?.choiceName || 'Default'
        };
      });

      selector.innerHTML = colors.map(({ variant, color }) => `<button type="button" class="variant-choice" data-variant-id="${variant.variantId}" aria-pressed="false">${color}</button>`).join('');

      let selected = colors.find(item => item.color.toLowerCase() === 'pink') || colors[0];

      const selectVariant = next => {
        selected = next;
        selector.querySelectorAll('.variant-choice').forEach(choice => {
          choice.setAttribute('aria-pressed', String(choice.dataset.variantId === selected.variant.variantId));
        });
        if (price) price.textContent = money(selected.variant.price?.actualPrice);
        if (compare) {
          const compareText = money(selected.variant.price?.compareAtPrice);
          compare.textContent = compareText;
          compare.hidden = !compareText;
        }
      };

      selector.querySelectorAll('.variant-choice').forEach(choice => {
        choice.addEventListener('click', () => {
          const next = colors.find(item => item.variant.variantId === choice.dataset.variantId);
          if (next) selectVariant(next);
        });
      });

      selectVariant(selected);
      button.disabled = false;
      button.textContent = 'Add to bag';

      button.addEventListener('click', async () => {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Adding…';
        try {
          const cart = await addToCart({
            productId,
            variantId: selected.variant.variantId,
            quantity: 1
          });
          const countEl = document.querySelector('.bag-count');
          if (countEl) countEl.textContent = `(${lineItemCount(cart)})`;
          showNotice('Added to your beauty bag.');
          await renderBag();
          document.getElementById('bag-dialog')?.showModal();
          document.body.classList.add('locked');
        } catch (error) {
          console.error('[Maison Surga] add to cart error', error);
          showNotice(error.message || 'Unable to add this item.', 'error');
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    } catch (error) {
      button.disabled = true;
      button.textContent = 'Unavailable';
      selector.innerHTML = '<p class="product-error">We could not load the live product options.</p>';
      console.error('[Maison Surga] product error', error);
    }
  };

  const initBag = () => {
    document.querySelector('[data-dialog="bag-dialog"]')?.addEventListener('click', renderBag);
    window.addEventListener('surga:cart-updated', renderBag);
    getCurrentCart()
      .then(cart => {
        const countEl = document.querySelector('.bag-count');
        if (countEl) countEl.textContent = `(${lineItemCount(cart)})`;
      })
      .catch(error => console.warn('[Maison Surga] initial cart unavailable', error));
  };

  window.MaisonWix = {
    CLIENT_ID,
    STORES_APP_ID,
    api,
    getCurrentCart,
    addToCart,
    getCheckoutUrl,
    queryVariants,
    lineItemCount,
    renderBag,
    initBag,
    initProductPage
  };
})();
