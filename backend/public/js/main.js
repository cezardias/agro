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
      updateHeroSection(currentCategory);
      fetchListings(currentCategory);
    });
  });

  // Modal close
  const closeBtn = document.querySelector('.close-modal');
  if(closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('user-modal').style.display = 'none';
    });
  }
});

function updateHeroSection(cat) {
  const heroTitle = document.getElementById('hero-title');
  const heroDesc = document.getElementById('hero-desc');
  const heroImg = document.getElementById('hero-img');
  
  if(!heroTitle || !heroDesc || !heroImg) return;

  const content = {
    'todos': {
      title: 'O Mercado Livre<br>do <span>Agro</span>.',
      desc: 'Compre, venda, alugue e contrate serviços com segurança. Tudo o que o campo precisa, de máquinas a mão de obra, em um só lugar.',
      img: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=800&q=80'
    },
    'maquinas': {
      title: 'Máquinas e<br><span>Implementos</span>',
      desc: 'Encontre tratores, colheitadeiras e implementos agrícolas novos e usados, para compra ou aluguel.',
      img: 'https://images.unsplash.com/photo-1592982537447-6f233c8702b0?w=800&q=80'
    },
    'veiculos': {
      title: 'Caminhões e<br><span>Utilitários</span>',
      desc: 'Veículos pesados para frete, boiadeiros, caminhonetes e utilitários para a lida diária.',
      img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80'
    },
    'terrenos': {
      title: 'Fazendas e<br><span>Sítios</span>',
      desc: 'As melhores oportunidades de terras, fazendas produtivas e arrendamentos na sua região.',
      img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80'
    },
    'animais': {
      title: 'Gado, Equinos<br>e <span>Manejo</span>',
      desc: 'Lotes de engorda, matrizes, reprodutores e animais de serviço direto do produtor.',
      img: 'https://images.unsplash.com/photo-1596733430284-f743727521a0?w=800&q=80'
    },
    'ferramentas': {
      title: 'Ferramentas<br><span>Agrícolas</span>',
      desc: 'Equipamentos menores, motosserras, bombas d\'água e tudo para manutenção.',
      img: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'
    },
    'mao_de_obra': {
      title: 'Serviços e<br><span>Especialistas</span>',
      desc: 'Veterinários, agrônomos, operadores de trator e mão de obra temporária.',
      img: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800&q=80'
    }
  };

  const selected = content[cat] || content['todos'];
  
  heroImg.style.opacity = '0';
  setTimeout(() => {
    heroTitle.innerHTML = selected.title;
    heroDesc.innerHTML = selected.desc;
    heroImg.src = selected.img;
    heroImg.style.opacity = '0.8';
  }, 200);
}

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
