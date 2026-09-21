(() => {
  const CLIENT_ID = '4a256781-4f9d-4ae4-a7f6-2bcb9589c2fb';
  const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
  const TOKEN_KEY = 'maisonSurgaWixVisitorV1';
  const AUTH_KEY = 'maisonSurgaWixAuthFlowV1';
  const CART_KEY = 'maisonSurgaWixCartV1';
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

  const randomBase64Url = size => {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const sha256Base64Url = async value => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    let binary = '';
    new Uint8Array(digest).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const savedCart = () => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || 'null'); }
    catch { return null; }
  };

  const saveCart = cart => {
    if (cart?.id && cart.orderPlaced !== true) localStorage.setItem(CART_KEY, JSON.stringify(cart));
    else if (!cart || cart.orderPlaced === true) localStorage.removeItem(CART_KEY);
    return cart || null;
  };

  const getCartById = async cartId => {
    if (!cartId) return null;
    const data = await api(`/ecom/v2/carts/${encodeURIComponent(cartId)}`);
    return saveCart(data.cart || null);
  };

  const getCurrentCart = async () => {
    const local = savedCart();

    if (local?.id && local.orderPlaced !== true) {
      try {
        const persisted = await getCartById(local.id);
        if (persisted) return persisted;
      } catch (error) {
        if (![401, 403, 404, 428].includes(error.status)) throw error;
      }
    }

    try {
      const data = await api('/ecom/v2/carts/current');
      return saveCart(data.cart || null);
    } catch (error) {
      if ([404, 428].includes(error.status)) return local;
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
    const cart = saveCart(data.cart || null);
    window.dispatchEvent(new CustomEvent('surga:cart-updated', { detail: cart }));
    return cart;
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

  const getMyMember = async () => {
    try {
      const data = await api('/members/v1/members/my');
      return data.member || null;
    } catch (error) {
      if ([401, 403, 404].includes(error.status)) return null;
      throw error;
    }
  };

  const startLogin = async () => {
    const redirectUri = new URL('auth-callback.html', location.href).href;
    const verifier = randomBase64Url(48);
    const challenge = await sha256Base64Url(verifier);
    const state = randomBase64Url(24);
    const returnTo = location.href.split('#')[0];

    localStorage.setItem(AUTH_KEY, JSON.stringify({ verifier, state, redirectUri, returnTo }));

    const data = await api('/_api/redirects-api/v1/redirect-session', {
      method: 'POST',
      body: JSON.stringify({
        auth: {
          authRequest: {
            redirectUri,
            clientId: CLIENT_ID,
            codeChallenge: challenge,
            codeChallengeMethod: 'S256',
            responseMode: 'fragment',
            responseType: 'code',
            scope: 'offline_access',
            state
          },
          prompt: 'login'
        }
      })
    });

    const url = data?.redirectSession?.fullUrl;
    if (!url) throw new Error('Wix login URL was not returned.');
    location.href = url;
  };

  const completeLoginFromCallback = async () => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const code = params.get('code');
    const returnedState = params.get('state');
    const error = params.get('error');
    const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');

    if (error) throw new Error(params.get('error_description') || error);
    if (!code || !stored?.verifier || !stored?.redirectUri) throw new Error('Missing login callback data.');
    if (!returnedState || returnedState !== stored.state) throw new Error('Login state verification failed.');

    await tokenRequest({
      clientId: CLIENT_ID,
      grantType: 'authorization_code',
      redirectUri: stored.redirectUri,
      code,
      codeVerifier: stored.verifier
    });

    localStorage.removeItem(AUTH_KEY);
    return stored.returnTo || new URL('index.html', location.href).href;
  };

  const logout = async () => {
    const data = await api('/_api/redirects-api/v1/redirect-session', {
      method: 'POST',
      body: JSON.stringify({
        logout: { clientId: CLIENT_ID },
        callbacks: { postFlowUrl: location.href.split('#')[0] }
      })
    });
    const url = data?.redirectSession?.fullUrl;
    localStorage.removeItem(TOKEN_KEY);
    if (!url) {
      location.reload();
      return;
    }
    location.href = url;
  };

  const quantityOf = item => Number(
    item?.quantityInfo?.confirmedQuantity ??
    item?.quantityInfo?.requestedQuantity ??
    item?.quantity ??
    0
  );

  const lineItemCount = cart => (cart?.lineItems || []).reduce((sum, item) => sum + quantityOf(item), 0);

  const money = value => {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') {
      const n = Number(value);
      return Number.isFinite(n) ? `£${n.toFixed(2)}` : '';
    }
    return value.formattedAmount ||
      value.formattedConvertedAmount ||
      (value.amount != null && Number.isFinite(Number(value.amount)) ? `£${Number(value.amount).toFixed(2)}` : '');
  };

  const lineImage = item =>
    item?.attributes?.image?.url ||
    item?.image?.url ||
    item?.media?.url ||
    item?.media?.image?.url ||
    '';

  const lineName = item =>
    item?.name?.original ||
    item?.name?.translated ||
    item?.productName?.original ||
    item?.productName ||
    'Maison Surga item';

  const descriptionOf = item => (item?.attributes?.descriptionLines || item?.descriptionLines || [])
    .filter(line => !/ships? from/i.test(line?.name?.original || line?.name?.translated || line?.name || ''))
    .map(line => line?.plainText?.original || line?.plainText?.translated || line?.plainText || '')
    .filter(Boolean)
    .join(' · ');

  const linePrice = item =>
    item?.pricing?.totalPrice ||
    item?.pricing?.unitPrice ||
    item?.lineItemPrice ||
    item?.price;

  const updateLineQuantity = async (lineItemId, newQuantity) => {
    if (newQuantity <= 0) return removeLineItem(lineItemId);
    const data = await api('/ecom/v2/carts/current/update-line-items', {
      method: 'POST',
      body: JSON.stringify({
        lineItems: [{
          lineItemId,
          quantity: { newQuantity }
        }]
      })
    });
    const cart = saveCart(data.cart || null);
    window.dispatchEvent(new CustomEvent('surga:cart-updated', { detail: cart }));
    return cart;
  };

  const removeLineItem = async lineItemId => {
    const data = await api('/ecom/v2/carts/current/remove-line-items', {
      method: 'POST',
      body: JSON.stringify({ lineItemIds: [lineItemId] })
    });
    const cart = saveCart(data.cart || null);
    window.dispatchEvent(new CustomEvent('surga:cart-updated', { detail: cart }));
    return cart;
  };

  const renderBag = async (cartOverride = null) => {
    const panel = document.getElementById('bag-content');
    const countEl = document.querySelector('.bag-count');
    if (!panel) return;

    panel.innerHTML = '<div class="bag-loading">Loading your bag…</div>';

    try {
      const cart = cartOverride || await getCurrentCart();
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
        const price = money(linePrice(item));
        const description = descriptionOf(item);
        const quantity = quantityOf(item);
        return `<article class="bag-line" data-line-item-id="${item.id}">
          ${image ? `<img src="${image}" alt="">` : '<div class="bag-line-placeholder"></div>'}
          <div class="bag-line-copy">
            <strong>${lineName(item)}</strong>
            ${description ? `<small>${description}</small>` : ''}
            <div class="bag-quantity" aria-label="Quantity">
              <button type="button" data-cart-action="decrease" aria-label="Decrease quantity">−</button>
              <span>${quantity}</span>
              <button type="button" data-cart-action="increase" aria-label="Increase quantity">+</button>
              <button type="button" class="bag-remove" data-cart-action="remove">Remove</button>
            </div>
          </div>
          <span>${price}</span>
        </article>`;
      }).join('');

      const subtotal = money(cart.subtotal);
      panel.innerHTML = `${lines}
        <div class="bag-summary">
          <div><span>Subtotal</span><strong>${subtotal || 'Calculated at checkout'}</strong></div>
          <button class="button dark bag-checkout" type="button">Continue to secure checkout <span>⟶</span></button>
          <small>Delivery, taxes and final total are confirmed securely at Wix checkout.</small>
        </div>`;

      panel.querySelectorAll('[data-cart-action]').forEach(control => {
        control.addEventListener('click', async event => {
          const button = event.currentTarget;
          const row = button.closest('[data-line-item-id]');
          const id = row?.dataset.lineItemId;
          const activeCart = savedCart() || cart;
          const activeItem = activeCart?.lineItems?.find(item => item.id === id);
          if (!id || !activeItem) return;
          const currentQuantity = quantityOf(activeItem);
          const action = button.dataset.cartAction;
          panel.querySelectorAll('button').forEach(el => { el.disabled = true; });
          try {
            const updated = action === 'remove'
              ? await removeLineItem(id)
              : await updateLineQuantity(id, action === 'increase' ? currentQuantity + 1 : currentQuantity - 1);
            await renderBag(updated);
          } catch (error) {
            showNotice(error.message || 'Unable to update your bag.', 'error');
            await renderBag(activeCart);
          }
        });
      });

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

  const renderAccount = async () => {
    const panel = document.getElementById('account-content');
    if (!panel) return;
    panel.innerHTML = `<p>Your existing Maison Surga account remains securely hosted by Wix while this new storefront is in staging.</p>
      <a class="button dark" href="https://www.maisonsurga.com/" target="_blank" rel="noopener">Open current member area <span>⟶</span></a>
      <small class="account-note">Cart and checkout are connected to the existing store. Native member sign-in will replace this handoff only after Wix Headless authentication passes our tests.</small>`;
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
    const mobilePrice = document.getElementById('mobile-product-price');
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
        const currentPrice = money(selected.variant.price?.actualPrice);
        if (price) price.textContent = currentPrice;
        if (mobilePrice) mobilePrice.textContent = currentPrice;
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
          await renderBag(cart);
          const dialog = document.getElementById('bag-dialog');
          if (dialog && !dialog.open) dialog.showModal();
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
    const countEl = document.querySelector('.bag-count');
    const local = savedCart();
    if (countEl && local) countEl.textContent = `(${lineItemCount(local)})`;

    document.querySelector('[data-dialog="bag-dialog"]')?.addEventListener('click', () => renderBag());
    window.addEventListener('surga:cart-updated', event => renderBag(event.detail || null));

    getCurrentCart()
      .then(cart => {
        if (countEl) countEl.textContent = `(${lineItemCount(cart)})`;
      })
      .catch(error => console.warn('[Maison Surga] initial cart unavailable', error));
  };

  const initAccount = () => {
    document.querySelector('[data-dialog="account-dialog"]')?.addEventListener('click', renderAccount);
  };

  window.MaisonWix = {
    CLIENT_ID,
    STORES_APP_ID,
    api,
    getCurrentCart,
    getCartById,
    addToCart,
    getCheckoutUrl,
    queryVariants,
    getMyMember,
    startLogin,
    completeLoginFromCallback,
    logout,
    lineItemCount,
    quantityOf,
    updateLineQuantity,
    removeLineItem,
    savedCart,
    saveCart,
    renderBag,
    renderAccount,
    initBag,
    initAccount,
    initProductPage
  };
})();
