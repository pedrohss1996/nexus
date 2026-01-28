// Dados mockados para desenvolvimento sem banco de dados

const mockUser = {
  id: 1,
  nome: 'Administrador Mock',
  email: 'admin@dataflow.com',
  perfil: 'admin',
  ativo: true,
  mock: true
};

const mockOrcamento = {
  utilizado: 248500,
  total: 330000,
  percentual: 75,
  categorias: [
    { nome: 'Operações', percentual: 74, cor: 'blue' },
    { nome: 'TI', percentual: 81, cor: 'amber' },
    { nome: 'Marketing', percentual: 99, cor: 'red' }
  ]
};

const mockSolicitacoesRecentes = [
  { 
    id: 'REQ-2024-001', 
    tipoDocumento: 'Compra de Medicamentos', 
    solicitante: 'Dr. Ricardo Silva - Farmácia', 
    data: '25/01/2024', 
    valor: 12500.00, 
    status: 'Pendente' 
  },
  { 
    id: 'REQ-2024-002', 
    tipoDocumento: 'Manutenção de Equipamentos', 
    solicitante: 'Eng. Maria Santos - Manutenção', 
    data: '24/01/2024', 
    valor: 8200.00, 
    status: 'Pendente' 
  },
  { 
    id: 'REQ-2024-003', 
    tipoDocumento: 'Contrato de Limpeza', 
    solicitante: 'Ana Costa - Administração', 
    data: '23/01/2024', 
    valor: 15000.00, 
    status: 'Em Análise' 
  },
  { 
    id: 'REQ-2024-004', 
    tipoDocumento: 'Aquisição de Software', 
    solicitante: 'Carlos Oliveira - TI', 
    data: '22/01/2024', 
    valor: 45000.00, 
    status: 'Aprovado' 
  },
  { 
    id: 'REQ-2024-005', 
    tipoDocumento: 'Material de Escritório', 
    solicitante: 'Patricia Lima - RH', 
    data: '21/01/2024', 
    valor: 3500.00, 
    status: 'Pendente' 
  }
];

module.exports = {
  mockUser,
  mockOrcamento,
  mockSolicitacoesRecentes
};
