CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'produtor', 'prestador', 'empresa'
  email VARCHAR(255) UNIQUE NOT NULL,
  whatsapp VARCHAR(20),
  reputation DECIMAL(3,1) DEFAULT 5.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'venda', 'aluguel', 'servico'
  category VARCHAR(50) NOT NULL, -- 'maquinas', 'ferramentas', 'terrenos', 'veiculos', 'mao_de_obra', 'animais'
  subcategory VARCHAR(100),
  price DECIMAL(15,2),
  region VARCHAR(100),
  description TEXT,
  metadata JSONB, -- Campos flexíveis como peso, km, horas de uso, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir dados de teste (Seed)
INSERT INTO users (name, type, email, whatsapp, reputation) VALUES
('João Agro', 'produtor', 'joao@agro.com', '11999999999', 4.8),
('LocaMáquinas', 'empresa', 'contato@locamaquinas.com', '11888888888', 4.9),
('Dr. Veterinário', 'prestador', 'vet@agro.com', '11777777777', 5.0),
('Fazendas e Cia', 'empresa', 'vendas@fazendasecia.com', '11666666666', 4.5);

INSERT INTO listings (user_id, title, transaction_type, category, subcategory, price, region, description, metadata) VALUES
(1, 'Lote de Novilhos Nelore', 'venda', 'animais', 'gado', 1800.00, 'Sudoeste Goiano', 'Lote bem formado, 180kg média, vacinação em dia.', '{"peso_medio": 180, "raca": "Nelore", "quantidade": 20}'),
(2, 'Trator John Deere 5075E', 'aluguel', 'maquinas', 'tratores', 800.00, 'Triângulo Mineiro', 'Trator em perfeito estado, valor da diária. Com operador.', '{"potencia": "75cv", "horas_uso": 1200}'),
(3, 'Consultoria Reprodutiva (IATF)', 'servico', 'mao_de_obra', 'veterinaria', 150.00, 'Goiás', 'Protocolo de IATF completo, valor por matriz. Inclui ultrassom.', '{"especialidade": "reproducao"}'),
(4, 'Sítio 15 Alqueires', 'venda', 'terrenos', 'fazenda', 1500000.00, 'Mato Grosso', 'Terra roxa, rica em água, casa sede boa, barracão.', '{"tamanho_ha": 36.3, "tem_agua": true}'),
(1, 'Gaiola para Suínos', 'venda', 'ferramentas', 'manejo', 350.00, 'Sul de Minas', 'Gaiola de gestação seminova, feita em chapa grossa.', '{"material": "ferro"}'),
(2, 'Caminhão Boiadeiro MB 1620', 'aluguel', 'veiculos', 'caminhao', 1200.00, 'São Paulo Interior', 'Frete boiadeiro. Valor por viagem curta (até 100km).', '{"capacidade_cabecas": 18}'),
(1, 'Aves Caipira Poedeiras', 'venda', 'animais', 'aves', 35.00, 'Paraná', 'Lote de 50 aves caipiras prontas para postura.', '{"raca": "Rhode Island Red", "idade_dias": 120}'),
(3, 'Colheita Terceirizada', 'servico', 'mao_de_obra', 'operacional', 250.00, 'Mato Grosso do Sul', 'Colheita de soja e milho, valor por hectare.', '{"maquina_inclusa": true}');
