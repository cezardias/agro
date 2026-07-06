document.addEventListener('DOMContentLoaded', () => {
  let currentCategory = 'todos';
  
  fetchListings();
  
  // Navbar scroll effect
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    } else {
      header.style.boxShadow = 'none';
    }
  });

  // Category filtering
  document.querySelectorAll('.cat-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.cat-link').forEach(l => l.classList.remove('active'));
      e.target.classList.add('active');
      
      currentCategory = e.target.dataset.category;
      fetchListings(currentCategory);
    });
  });

  // Modal close
  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('user-modal').style.display = 'none';
  });
});

async function fetchListings(category = 'todos') {
  const container = document.getElementById('marketplace-grid');
  if (!container) return;
  
  container.innerHTML = '<p style="color:var(--text-muted)">Carregando anúncios...</p>';
  
  try {
    const url = category === 'todos' ? '/api/listings' : `/api/listings?category=${category}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Falha ao carregar');
    
    const data = await response.json();
    renderListings(data, container);
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">
        Erro ao conectar com o servidor. Verifique se o backend e banco estão rodando.
      </div>
    `;
  }
}

function getCategoryIcon(cat) {
  const icons = {
    'maquinas': '🚜',
    'ferramentas': '🔧',
    'terrenos': '🏡',
    'veiculos': '🚛',
    'mao_de_obra': '👷',
    'animais': '🐄'
  };
  return icons[cat] || '📦';
}

function renderMetadata(metadata) {
  if (!metadata) return '';
  let html = '<div class="metadata-grid">';
  for (const [key, value] of Object.entries(metadata)) {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let displayValue = value;
    if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';
    html += `<div class="meta-item">${label}<strong>${displayValue}</strong></div>`;
  }
  html += '</div>';
  return html;
}

function renderListings(listings, container) {
  if (!listings || listings.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; text-align:center;">Nenhum anúncio encontrado nesta categoria.</p>';
    return;
  }
  
  container.innerHTML = '';
  
  listings.forEach(item => {
    const icon = getCategoryIcon(item.category);
    
    // Tag class (venda, aluguel, servico)
    const tagClass = item.transaction_type.toLowerCase().replace('ç','c');
    
    const card = document.createElement('div');
    card.className = 'animal-card';
    card.innerHTML = `
      <div style="cursor: pointer" onclick="window.location.href='/produto.html?id=${item.id}'">
        <div class="card-header">
          <span class="tag ${tagClass}">${item.transaction_type}</span>
          <span class="cat-icon">${icon}</span>
        </div>
        <div class="animal-content" style="padding-bottom: 0;">
          <h3 class="animal-title">${item.title}</h3>
          <div class="animal-price">R$ ${parseFloat(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          
          <div class="animal-meta">
            📍 ${item.region}
          </div>
          
          ${renderMetadata(item.metadata)}
          
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem; flex:1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${item.description}
          </p>
        </div>
      </div>
      <div class="animal-content" style="padding-top: 0; flex: none;">
        <div class="seller-info" onclick="openUserProfile(${item.user_id})">
          <div class="seller-avatar">${item.user_name.charAt(0).toUpperCase()}</div>
          <div class="seller-name">${item.user_name}</div>
          <div class="seller-rep">⭐ ${item.user_reputation}</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function openUserProfile(userId) {
  const modal = document.getElementById('user-modal');
  const body = document.getElementById('modal-body');
  
  body.innerHTML = '<p>Carregando perfil...</p>';
  modal.style.display = 'block';
  
  try {
    const res = await fetch(`/api/users/${userId}`);
    const user = await res.json();
    
    body.innerHTML = `
      <div class="modal-user-header">
        <div class="modal-user-avatar">${user.name.charAt(0)}</div>
        <div>
          <h2>${user.name}</h2>
          <p style="color: var(--text-muted)">Membro desde ${new Date(user.created_at).getFullYear()} • Reputação ⭐ ${user.reputation}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 2rem;">
        <p><strong>Tipo:</strong> <span style="text-transform: capitalize">${user.type}</span></p>
        <p><strong>WhatsApp:</strong> ${user.whatsapp}</p>
      </div>
      
      <h3>Anúncios deste vendedor</h3>
      <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
        ${user.listings.length} anúncio(s) ativo(s).
      </div>
    `;
  } catch (err) {
    body.innerHTML = '<p>Erro ao carregar o perfil.</p>';
  }
}
