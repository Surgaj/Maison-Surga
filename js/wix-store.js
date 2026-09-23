(() => {
  const CLIENT_ID = '4a256781-4f9d-4ae4-a7f6-2bcb9589c2fb';
  const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
  const TOKEN_KEY = 'maisonSurgaWixVisitorV3';
  const AUTH_KEY = 'maisonSurgaWixAuthFlowV3';
  const FAVOURITES_KEY = 'maisonSurgaFavouritesV1';
  const CART_KEY = 'maisonSurgaWixCartV3';
  const API_ROOT = 'https://www.wixapis.com';
  const DEFAULT_PRODUCT_ID = 'b3264b49-f087-482a-bb94-1bd1f104249e';
  const CATEGORY_CONFIG = {
    skincare: {
      id: '0d5da727-207f-44bc-951a-456e3e08957c',
      curatedIds: ["b3264b49-f087-482a-bb94-1bd1f104249e","f0b9c317-fcba-4029-9449-7f387d0a28a2","e9059439-4894-48cf-81b4-fe1bcfe3d6d1","9a468a63-1661-4e28-a818-47d6959d1c3d"],
      title: 'Skincare',
      eyebrow: 'THE SKINCARE EDIT',
      description: 'Everyday rituals for cleansing, massage and mindful skin care.'
    },
    tools: {
      id: 'c1aa6676-1ee4-46c9-82e7-8c2d8f8a017a',
      curatedIds: ["f0b9c317-fcba-4029-9449-7f387d0a28a2","e9059439-4894-48cf-81b4-fe1bcfe3d6d1","e8680269-c15a-4fe1-8bf5-d26a707d5727","7a74e237-aafd-425a-bd71-0b0fbe7cd9d8"],
      title: 'Beauty Tools',
      eyebrow: 'THE BEAUTY TOOLS EDIT',
      description: 'Practical tools chosen to make everyday beauty feel a little more intentional.'
    },
    makeup: {
      id: 'dbc8b26a-73ab-47cb-946b-f22f15ad1085',
      curatedIds: ["02cfe8d1-4600-4b43-8561-8c9c7e506bc8","8bdb4295-79ef-4f3e-a0c9-cb41cd3543e4","7f493ad7-8919-4d0e-a0ad-f073dcefa575","c7ea6e66-7c67-40bf-9023-45ab80ad08eb"],
      title: 'Makeup',
      eyebrow: 'THE MAKEUP EDIT',
      description: 'A focused edit of colour, texture and easy everyday beauty.'
    },
    selfcare: {
      id: '021c7d81-2427-4a8f-8da7-79042bcca0b8',
      curatedIds: ["0fdfba60-9cd9-4c7f-baba-6a570234a95f","b3264b49-f087-482a-bb94-1bd1f104249e","e9059439-4894-48cf-81b4-fe1bcfe3d6d1","9a468a63-1661-4e28-a818-47d6959d1c3d"],
      title: 'Self-Care',
      eyebrow: 'THE SELF-CARE EDIT',
      description: 'Small comforts and slower rituals for moments that are just yours.'
    }
  };

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

  const sha256BytesFallback = value => {
    const input = new TextEncoder().encode(value);
    const bitLength = input.length * 8;
    const totalLength = Math.ceil((input.length + 9) / 64) * 64;
    const padded = new Uint8Array(totalLength);
    padded.set(input);
    padded[input.length] = 0x80;

    const view = new DataView(padded.buffer);
    view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(totalLength - 4, bitLength >>> 0);

    const rotr = (value32, amount) => (value32 >>> amount) | (value32 << (32 - amount));
    const k = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    const h = new Uint32Array([
      0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
      0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    ]);
    const w = new Uint32Array(64);

    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let [a,b,c,d,e,f,g,hh] = h;
      for (let i = 0; i < 64; i++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }

      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
      h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }

    const output = new Uint8Array(32);
    const outputView = new DataView(output.buffer);
    h.forEach((word, index) => outputView.setUint32(index * 4, word));
    return output;
  };

  const sha256Base64Url = async value => {
    let bytes;
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      bytes = new Uint8Array(digest);
    } else {
      bytes = sha256BytesFallback(value);
    }

    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
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

  const queryProducts = async () => {
    const data = await api('/stores/v3/products/query', {
      method: 'POST',
      body: JSON.stringify({
        fields: ['CURRENCY', 'DIRECT_CATEGORIES_INFO', 'URL'],
        query: { cursorPaging: { limit: 100 } }
      })
    });
    return data.products || [];
  };

  const getProduct = async productId => {
    const fields = new URLSearchParams();
    ['CURRENCY', 'MEDIA_ITEMS_INFO', 'PLAIN_DESCRIPTION', 'URL', 'DIRECT_CATEGORIES_INFO'].forEach(field => fields.append('fields', field));
    const data = await api(`/stores/v3/products/${encodeURIComponent(productId)}?${fields.toString()}`);
    return data.product || null;
  };

  const productImage = product =>
    product?.media?.main?.image?.url ||
    product?.media?.main?.thumbnail?.url ||
    product?.media?.itemsInfo?.items?.find(item => item?.image?.url)?.image?.url ||
    '';

  const stripHtml = value => {
    if (!value) return '';
    const doc = new DOMParser().parseFromString(value, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const variantPrice = variant => variant?.price?.actualPrice || null;

  const lowestVariant = variants => {
    const sellable = variants.filter(v => v.visible !== false && v.inventoryStatus?.inStock !== false);
    return sellable.sort((a,b) => Number(variantPrice(a)?.amount || Infinity) - Number(variantPrice(b)?.amount || Infinity))[0] || variants[0] || null;
  };

  const categoryKeyFromUrl = () => {
    const raw = (new URLSearchParams(location.search).get('category') || 'skincare').toLowerCase();
    const aliases = { skin: 'skincare', skincare: 'skincare', tools: 'tools', 'beauty-tools': 'tools', makeup: 'makeup', selfcare: 'selfcare', 'self-care': 'selfcare' };
    return aliases[raw] || 'skincare';
  };

  const initCollectionPage = async () => {
    const root = document.getElementById('collection-content');
    if (!root) return;

    const key = categoryKeyFromUrl();
    const config = CATEGORY_CONFIG[key];
    document.title = `${config.title} — Maison Surga`;
    root.innerHTML = `<section class="collection-intro"><p class="eyebrow">${config.eyebrow}</p><h1>${config.title}</h1><p>${config.description}</p></section><section class="catalog-section"><div class="catalog-status">Loading the live Maison Surga catalogue…</div><div class="product-grid" id="product-grid"></div></section>`;

    try {
      const products = (await queryProducts()).filter(product =>
        product.visible !== false &&
        config.curatedIds.includes(product.id) &&
        (product.directCategoriesInfo?.categories || []).some(category => category.id === config.id)
      );

      const cards = await Promise.all(products.map(async product => {
        const variants = await queryVariants(product.id);
        const variant = lowestVariant(variants);
        return {
          product,
          price: money(variantPrice(variant))
        };
      }));

      const grid = document.getElementById('product-grid');
      const status = root.querySelector('.catalog-status');

      if (!cards.length) {
        status.textContent = 'This edit is being prepared.';
        return;
      }

      status.textContent = `${cards.length} products in this edit`;
      grid.innerHTML = cards.map(({product,price}) => `<a class="product-card" href="product.html?id=${encodeURIComponent(product.id)}" data-product-id="${product.id}" data-product-name="${product.name.replace(/"/g,'&quot;')}" data-product-image="${productImage(product)}" data-product-price="${price || ''}">
        <button class="favourite-button product-card-favourite" type="button" data-favourite-id="${product.id}" aria-label="Save to favourites" aria-pressed="false">♡</button>
        <div class="product-card-image">${productImage(product) ? `<img src="${productImage(product)}" alt="${product.name}" loading="lazy">` : '<div class="product-card-placeholder"></div>'}</div>
        <div class="product-card-copy">
          <span class="product-card-category">${config.title}</span>
          <h2>${product.name}</h2>
          <div><strong>${price || 'View product'}</strong><span>View <b>⟶</b></span></div>
        </div>
      </a>`).join('');

      grid.querySelectorAll('.product-card-favourite').forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const card = button.closest('.product-card');
          const result = toggleFavourite(favouritePayloadFromCard(card));
          syncFavouriteButtons();
          showNotice(result.saved ? 'Saved to favourites.' : 'Removed from favourites.');
        });
      });
      syncFavouriteButtons();
    } catch (error) {
      console.error('[Maison Surga] collection error', error);
      root.querySelector('.catalog-status').textContent = 'We could not load this edit right now. Please try again.';
    }
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

  const authorizeMemberSession = async sessionToken => {
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
            state,
            sessionToken
          }
        }
      })
    });

    const url = data?.redirectSession?.fullUrl;
    if (!url) throw new Error('Wix authorization URL was not returned.');
    location.href = url;
  };

  const loginMember = async (email, password) => {
    const data = await api('/_api/iam/authentication/v2/login', {
      method: 'POST',
      body: JSON.stringify({
        loginId: { email },
        password
      })
    });

    if (data.state === 'SUCCESS' && data.sessionToken) {
      await authorizeMemberSession(data.sessionToken);
      return;
    }

    if (data.state === 'REQUIRE_OWNER_APPROVAL') {
      throw new Error('This account is waiting for approval.');
    }

    if (data.state === 'REQUIRE_EMAIL_VERIFICATION') {
      throw new Error('Please verify your email before signing in.');
    }

    throw new Error(data.message || 'We could not sign you in with those details.');
  };

  const registerMember = async ({ email, password, firstName, lastName }) => {
    const data = await api('/_api/iam/authentication/v2/register', {
      method: 'POST',
      body: JSON.stringify({
        loginId: { email },
        password,
        profile: { firstName, lastName, nickname: firstName || email.split('@')[0] }
      })
    });

    if (data.state === 'SUCCESS' && data.sessionToken) {
      await authorizeMemberSession(data.sessionToken);
      return { success: true };
    }

    if (data.state === 'REQUIRE_EMAIL_VERIFICATION' && data.stateToken) {
      return { verificationRequired: true, stateToken: data.stateToken };
    }

    if (data.state === 'REQUIRE_OWNER_APPROVAL') {
      throw new Error('Your account was created and is waiting for approval.');
    }

    throw new Error(data.message || 'We could not create your account.');
  };

  const verifyMemberRegistration = async ({ code, stateToken }) => {
    const data = await api('/_api/iam/verification/v1/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ code, stateToken })
    });
    if (data.state === 'SUCCESS' && data.sessionToken) {
      await authorizeMemberSession(data.sessionToken);
      return;
    }
    throw new Error(data.message || 'That verification code could not be confirmed.');
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
          }
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

  const getFavourites = () => {
    try { return JSON.parse(localStorage.getItem(FAVOURITES_KEY) || '[]'); }
    catch { return []; }
  };

  const saveFavourites = items => {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('surga:favourites-updated', { detail: items }));
    return items;
  };

  const isFavourite = productId => getFavourites().some(item => item.id === productId);

  const toggleFavourite = product => {
    const current = getFavourites();
    const exists = current.some(item => item.id === product.id);
    const next = exists
      ? current.filter(item => item.id !== product.id)
      : [product, ...current.filter(item => item.id !== product.id)].slice(0, 50);
    saveFavourites(next);
    return { saved: !exists, items: next };
  };

  const syncFavouriteButtons = () => {
    document.querySelectorAll('[data-favourite-id]').forEach(button => {
      const saved = isFavourite(button.dataset.favouriteId);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? 'Remove from favourites' : 'Save to favourites');
      button.classList.toggle('saved', saved);
      button.textContent = saved ? '♥' : '♡';
    });
  };

  const favouritePayloadFromCard = card => ({
    id: card.dataset.productId,
    name: card.dataset.productName,
    image: card.dataset.productImage || '',
    price: card.dataset.productPrice || '',
    url: card.getAttribute('href') || `product.html?id=${encodeURIComponent(card.dataset.productId)}`
  });

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

  const renderSignedOutAccount = panel => {
    panel.innerHTML = `<div class="account-managed-login">
      <p>Sign in securely with your Maison Surga member account.</p>
      <button class="button dark account-login" type="button">Continue to secure sign in <span>⟶</span></button>
      <small class="account-note">Sign-in and account creation are securely handled by Wix. Available login methods are shown on the next screen.</small>
    </div>`;

    panel.querySelector('.account-login')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.innerHTML = 'Opening secure sign in…';
      try {
        await startLogin();
      } catch (error) {
        console.error('[Maison Surga] managed login error', error);
        button.disabled = false;
        button.innerHTML = 'Continue to secure sign in <span>⟶</span>';
        showNotice('We could not open secure sign in. Please try again.', 'error');
      }
    });
  };

  const renderAccount = async () => {
    const panel = document.getElementById('account-content');
    if (!panel) return;

    // Never trap the customer behind a loading state. The sign-in action is
    // usable immediately while we quietly check whether a Wix member session exists.
    renderSignedOutAccount(panel);

    try {
      const member = await Promise.race([
        getMyMember(),
        new Promise(resolve => setTimeout(() => resolve(null), 2500))
      ]);

      if (!member) return;

      const displayName = member.profile?.nickname || member.contact?.firstName || member.loginEmail || 'Maison Surga member';
      const favourites = getFavourites();
      const cart = await getCurrentCart().catch(() => savedCart());

      panel.innerHTML = `<div class="account-hub">
        <div class="account-hub-head">
          <span class="account-status">SIGNED IN</span>
          <h3>Welcome, ${displayName}.</h3>
          ${member.loginEmail ? `<p>${member.loginEmail}</p>` : ''}
        </div>
        <div class="account-tabs" role="tablist" aria-label="Your Maison Surga">
          <button type="button" data-account-tab="orders" aria-selected="true">Orders</button>
          <button type="button" data-account-tab="favourites" aria-selected="false">Favourites <span>${favourites.length}</span></button>
          <button type="button" data-account-tab="bag" aria-selected="false">Bag <span>${lineItemCount(cart)}</span></button>
          <button type="button" data-account-tab="profile" aria-selected="false">Account</button>
        </div>
        <div class="account-tab-panel" id="account-tab-panel"></div>
      </div>`;

      const tabPanel = panel.querySelector('#account-tab-panel');
      const tabs = [...panel.querySelectorAll('[data-account-tab]')];

      const renderTab = async tab => {
        tabs.forEach(button => button.setAttribute('aria-selected', String(button.dataset.accountTab === tab)));

        if (tab === 'orders') {
          tabPanel.innerHTML = `<section class="account-section">
            <p class="eyebrow">MY ORDERS</p>
            <h4>Purchase history</h4>
            <p>Your Wix member area keeps your current and past store orders, order details and tracking information.</p>
            <a class="button dark" href="https://www.maisonsurga.com/" target="_blank" rel="noopener">Open secure order history <span>⟶</span></a>
            <small>On the Wix member area, choose <strong>My Orders</strong>.</small>
          </section>`;
          return;
        }

        if (tab === 'favourites') {
          const items = getFavourites();
          if (!items.length) {
            tabPanel.innerHTML = `<section class="account-section account-empty"><p class="eyebrow">FAVOURITES</p><h4>Your saved edit is empty.</h4><p>Tap the heart on any product to keep it here.</p><a class="text-link" href="collection.html?category=skincare">Explore the edits <span>⟶</span></a></section>`;
            return;
          }
          tabPanel.innerHTML = `<section class="account-section"><p class="eyebrow">FAVOURITES</p><div class="account-favourites">${items.map(item => `<article class="account-favourite" data-favourite-row="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="">` : '<div class="account-favourite-placeholder"></div>'}
            <div><a href="${item.url || `product.html?id=${encodeURIComponent(item.id)}`}"><strong>${item.name}</strong></a><small>${item.price || ''}</small></div>
            <button type="button" data-remove-favourite="${item.id}" aria-label="Remove ${item.name} from favourites">×</button>
          </article>`).join('')}</div><small class="account-favourites-note">Favourites are saved on this device during staging.</small></section>`;
          tabPanel.querySelectorAll('[data-remove-favourite]').forEach(remove => remove.addEventListener('click', () => {
            saveFavourites(getFavourites().filter(item => item.id !== remove.dataset.removeFavourite));
            const favTab = tabs.find(button => button.dataset.accountTab === 'favourites')?.querySelector('span');
            if (favTab) favTab.textContent = getFavourites().length;
            renderTab('favourites');
            syncFavouriteButtons();
          }));
          return;
        }

        if (tab === 'bag') {
          const activeCart = await getCurrentCart().catch(() => savedCart());
          const items = activeCart?.lineItems || [];
          if (!items.length) {
            tabPanel.innerHTML = `<section class="account-section account-empty"><p class="eyebrow">MY BAG</p><h4>Your beauty bag is empty.</h4><a class="text-link" href="collection.html?category=skincare">Start shopping <span>⟶</span></a></section>`;
            return;
          }
          tabPanel.innerHTML = `<section class="account-section"><p class="eyebrow">MY BAG</p><div class="account-bag-lines">${items.map(item => `<div class="account-bag-line"><div><strong>${lineName(item)}</strong><small>Qty ${quantityOf(item)}</small></div><span>${money(linePrice(item))}</span></div>`).join('')}</div><div class="account-bag-total"><span>Subtotal</span><strong>${money(activeCart.subtotal)}</strong></div><button class="button dark account-open-bag" type="button">Open bag & checkout <span>⟶</span></button></section>`;
          tabPanel.querySelector('.account-open-bag')?.addEventListener('click', async () => {
            document.getElementById('account-dialog')?.close();
            document.body.classList.remove('locked');
            await renderBag(activeCart);
            const bagDialog = document.getElementById('bag-dialog');
            if (bagDialog && !bagDialog.open) bagDialog.showModal();
            document.body.classList.add('locked');
          });
          return;
        }

        tabPanel.innerHTML = `<section class="account-section"><p class="eyebrow">MY ACCOUNT</p><h4>${displayName}</h4>${member.loginEmail ? `<p>${member.loginEmail}</p>` : ''}<button class="text-link account-logout" type="button">Sign out <span>⟶</span></button></section>`;
        tabPanel.querySelector('.account-logout')?.addEventListener('click', logout);
      };

      tabs.forEach(button => button.addEventListener('click', () => renderTab(button.dataset.accountTab)));
      window.addEventListener('surga:favourites-updated', event => {
        const favTab = tabs.find(button => button.dataset.accountTab === 'favourites')?.querySelector('span');
        if (favTab) favTab.textContent = event.detail.length;
      }, { once: true });
      await renderTab('orders');
    } catch (error) {
      console.warn('[Maison Surga] account session check unavailable; sign in remains available.', error);
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
    const root = document.querySelector('[data-product-root]');
    if (!root) return;

    const productId = new URLSearchParams(location.search).get('id') || DEFAULT_PRODUCT_ID;
    const selector = document.getElementById('variant-options');
    const price = document.getElementById('product-price');
    const compare = document.getElementById('product-compare-price');
    const mobilePrice = document.getElementById('mobile-product-price');
    const button = document.getElementById('add-to-bag');
    const title = document.getElementById('product-title');
    const description = document.getElementById('product-description');
    const gallery = document.getElementById('live-gallery');
    const thumbs = document.getElementById('live-gallery-thumbs');
    const optionLabel = document.getElementById('product-options-label');
    if (!selector || !button) return;

    button.disabled = true;
    button.textContent = 'Loading…';

    try {
      const [product, allVariants] = await Promise.all([getProduct(productId), queryVariants(productId)]);
      if (!product) throw new Error('Product not found.');
      const variants = allVariants.filter(v => v.visible !== false && v.inventoryStatus?.inStock !== false);
      if (!variants.length) throw new Error('This product is not available.');

      document.title = `${product.name} — Maison Surga`;
      if (title) title.textContent = product.name;
      if (description) {
        const clean = stripHtml(product.plainDescription);
        description.textContent = clean ? clean.slice(0, 420) : 'A curated Maison Surga find for an everyday beauty ritual.';
      }

      const mediaItems = product.media?.itemsInfo?.items || [];
      const mainImage = productImage(product);
      const galleryImages = mediaItems.map(item => item?.image?.url).filter(Boolean);
      const images = [mainImage, ...galleryImages].filter((url, index, all) => url && all.indexOf(url) === index);
      if (gallery && images.length) {
        gallery.innerHTML = images.slice(0,6).map((url,index) => `<img src="${url}" alt="${product.name}${index ? ' view '+(index+1) : ''}" ${index ? 'loading="lazy"' : ''}>`).join('');
        if (thumbs) thumbs.innerHTML = images.slice(0,6).map((url,index) => `<button type="button" aria-label="View image ${index+1}" aria-current="${index===0}"><img src="${url}" alt=""></button>`).join('');
        const thumbButtons=[...thumbs.querySelectorAll('button')];
        thumbButtons.forEach((b,i)=>b.addEventListener('click',()=>gallery.scrollTo({left:gallery.clientWidth*i,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})));
        gallery.addEventListener('scroll',()=>{const selected=Math.round(gallery.scrollLeft/gallery.clientWidth);thumbButtons.forEach((b,i)=>b.setAttribute('aria-current',String(i===selected)));},{passive:true});
      }

      const optionNames = [...new Set(variants.flatMap(v => (v.optionChoices || []).map(choice => choice.optionChoiceNames?.optionName)).filter(name => name && !/ships? from/i.test(name)))];
      const selections = {};
      const valuesByOption = {};
      optionNames.forEach(name => {
        valuesByOption[name] = [...new Set(variants.flatMap(v => (v.optionChoices || [])
          .filter(choice => choice.optionChoiceNames?.optionName === name)
          .map(choice => choice.optionChoiceNames?.choiceName)
          .filter(Boolean)))];
        selections[name] = name.toLowerCase() === 'color' && valuesByOption[name].some(v => v.toLowerCase()==='pink')
          ? valuesByOption[name].find(v => v.toLowerCase()==='pink')
          : valuesByOption[name][0];
      });

      const matchesSelections = variant => optionNames.every(name =>
        (variant.optionChoices || []).some(choice =>
          choice.optionChoiceNames?.optionName === name &&
          choice.optionChoiceNames?.choiceName === selections[name]
        )
      );

      let selected = variants.find(matchesSelections) || lowestVariant(variants);

      const updateSelected = () => {
        selected = variants.find(matchesSelections) || lowestVariant(variants);
        const currentPrice = money(selected?.price?.actualPrice);
        if (price) price.textContent = currentPrice || 'View at checkout';
        if (mobilePrice) mobilePrice.textContent = currentPrice || '';
        if (compare) {
          compare.textContent = '';
          compare.hidden = true;
        }
        selector.querySelectorAll('[data-option-name][data-option-value]').forEach(choice => {
          choice.setAttribute('aria-pressed', String(selections[choice.dataset.optionName] === choice.dataset.optionValue));
        });
      };

      if (!optionNames.length) {
        optionLabel.textContent = 'Available now';
        selector.innerHTML = '<span class="muted-note">Ready to add to your bag.</span>';
      } else {
        optionLabel.textContent = 'Choose your option';
        selector.innerHTML = optionNames.map(name => `<div class="variant-group"><span>${name}</span><div>${valuesByOption[name].map(value => `<button type="button" class="variant-choice" data-option-name="${name}" data-option-value="${value}" aria-pressed="false">${value}</button>`).join('')}</div></div>`).join('');
        selector.querySelectorAll('.variant-choice').forEach(choice => {
          choice.addEventListener('click', () => {
            selections[choice.dataset.optionName] = choice.dataset.optionValue;
            updateSelected();
          });
        });
      }

      updateSelected();
      button.disabled = false;
      button.textContent = 'Add to bag';

      const favouriteButton = document.getElementById('product-favourite');
      if (favouriteButton) {
        favouriteButton.dataset.favouriteId = productId;
        favouriteButton.addEventListener('click', () => {
          const result = toggleFavourite({
            id: productId,
            name: product.name,
            image: productImage(product),
            price: money(selected?.price?.actualPrice),
            url: `product.html?id=${encodeURIComponent(productId)}`
          });
          syncFavouriteButtons();
          showNotice(result.saved ? 'Saved to favourites.' : 'Removed from favourites.');
        });
        syncFavouriteButtons();
      }

      button.addEventListener('click', async () => {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Adding…';
        try {
          const cart = await addToCart({ productId, variantId: selected?.variantId, quantity: 1 });
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
      selector.innerHTML = '<p class="product-error">We could not load this product right now.</p>';
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
    document.querySelectorAll('[data-dialog="account-dialog"]').forEach(trigger => {
      trigger.addEventListener('click', renderAccount);
    });
    // Prepare the panel immediately so desktop and mobile never show a stale loader.
    renderAccount();
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
    queryProducts,
    getProduct,
    initCollectionPage,
    getMyMember,
    startLogin,
    loginMember,
    registerMember,
    verifyMemberRegistration,
    authorizeMemberSession,
    completeLoginFromCallback,
    logout,
    lineItemCount,
    quantityOf,
    getFavourites,
    toggleFavourite,
    syncFavouriteButtons,
    updateLineQuantity,
    removeLineItem,
    savedCart,
    saveCart,
    renderBag,
    renderAccount,
    initBag,
    initAccount,
    initProductPage,
    CATEGORY_CONFIG
  };
})();
