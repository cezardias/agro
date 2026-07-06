document.addEventListener('DOMContentLoaded', () => {
  // Fetch mock data from the existing API
  fetchMarketplaceData();
  
  // Navbar blur effect on scroll
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.style.background = 'rgba(10, 15, 24, 0.85)';
      header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
    } else {
      header.style.background = 'rgba(10, 15, 24, 0.7)';
      header.style.boxShadow = 'none';
    }
  });
});

async function fetchMarketplaceData() {
  const container = document.getElementById('marketplace-grid');
  if (!container) return;
  
  try {
    const response = await fetch('/api/marketplace/animals');
    if (!response.ok) throw new Error('Falha ao carregar dados');
    
    const data = await response.json();
    renderAnimals(data, container);
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">
        Não foi possível carregar os anúncios no momento. Mas o app funciona offline!
      </div>
    `;
  }
}

function renderAnimals(animals, container) {
  if (!animals.length) {
    container.innerHTML = '<p>Nenhum anúncio encontrado.</p>';
    return;
  }
  
  container.innerHTML = '';
  
  animals.forEach(animal => {
    // Determine icon based on category for the placeholder
    let icon = '🐄';
    if (animal.category === 'recria' || animal.title.toLowerCase().includes('novilho')) {
      icon = '🐂';
    }
    
    const card = document.createElement('div');
    card.className = 'animal-card';
    card.innerHTML = `
      <div class="animal-img-placeholder">
        ${icon}
      </div>
      <div class="animal-content">
        <h3 class="animal-title">${animal.title}</h3>
        <div class="animal-price">R$ ${animal.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        <div class="animal-meta">
          <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${animal.region}</span>
          <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> ${animal.category}</span>
        </div>
        <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">
          ${animal.description}
        </p>
        <button class="btn btn-outline" style="width: 100%;">Fazer Oferta</button>
      </div>
    `;
    container.appendChild(card);
  });
}
