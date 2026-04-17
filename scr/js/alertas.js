/* =============================
   Configuracao da aplicacao
   ============================= */

const estaEmAmbienteLocal = globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1";
const API_BASE = estaEmAmbienteLocal && globalThis.location.port !== "3000"
  ? "http://localhost:3000"
  : "";

// Elemento de áudio para tocar o alerta
let audioAlerta = null;

/* =============================
   Referencias de elementos DOM
   ============================= */

const btnIrInicio = document.getElementById("btnIrInicio");
const statusLogin = document.getElementById("statusLogin");
const totalAlertasTexto = document.getElementById("totalAlertasTexto");
const btnAtualizarAlertas = document.getElementById("btnAtualizarAlertas");
const alertasVazio = document.getElementById("alertasVazio");
const alertasContainer = document.getElementById("alertasContainer");
const alertasCorpo = document.getElementById("alertasCorpo");

/* =============================
   Funcoes principais
   ============================= */

// Atualiza o status de login na interface
function atualizarStatusLogin() {
  try {
    const usuario = localStorage.getItem("sos_anjo_usuario_logado");
    const usuarioObj = usuario ? JSON.parse(usuario) : null;
    
    if (statusLogin) {
      if (usuarioObj?.nome) {
        statusLogin.textContent = `Logado: Anjo ${usuarioObj.nome}`;
      } else {
        statusLogin.textContent = "Não logado";
      }
    }
  } catch (e) {
    console.warn("Nao foi possivel atualizar status de login:", e);
    if (statusLogin) {
      statusLogin.textContent = "Não logado";
    }
  }
}

// Inicia reprodução do áudio de alerta em loop
function iniciarAudio() {
  if (!audioAlerta) {
    audioAlerta = new Audio("scr/audios/alerta.wav");
    audioAlerta.loop = true;
    audioAlerta.volume = 1;
  }
  
  // Tenta reproduzir o arquivo de áudio
  const promisePlay = audioAlerta.play();
  if (promisePlay !== undefined) {
    promisePlay.catch(() => {
      console.warn("Não foi possível reproduzir scr/audios/alerta.wav, usando tom de alerta alternativo");
      // Se o arquivo não existir, usa a Web Audio API para gerar um tom
      gerarTomAlerta();
    });
  }
}

// Gera um tom de alerta usando Web Audio API (fallback)
function gerarTomAlerta() {
  try {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    
    // Cria osciladores para gerar um som de alerta
    const oscilador = audioContext.createOscillator();
    const ganho = audioContext.createGain();
    
    oscilador.connect(ganho);
    ganho.connect(audioContext.destination);
    
    // Frequência e volume iniciais
    oscilador.frequency.value = 800;
    ganho.gain.setValueAtTime(0.3, audioContext.currentTime);
    
    oscilador.start();
    
    // Cria um padrão: bip-bip-bip a cada 2 segundos
    let tempoAtual = audioContext.currentTime;
    const intervalo = setInterval(() => {
      if (!audioAlerta || (audioAlerta?.paused)) {
        oscilador.stop();
        clearInterval(intervalo);
        return;
      }
      
      tempoAtual = audioContext.currentTime;
      oscilador.frequency.setValueAtTime(800, tempoAtual);
      oscilador.frequency.setValueAtTime(600, tempoAtual + 0.2);
      oscilador.frequency.setValueAtTime(800, tempoAtual + 0.4);
    }, 2000);
    
    // Armazena o intervalo no áudio para poder cancelar depois
    if (!audioAlerta) audioAlerta = {};
    audioAlerta._tongerador = intervalo;
    audioAlerta._oscilador = oscilador;
  } catch (e) {
    console.error("Erro ao gerar tom de alerta:", e);
  }
}

// Para a reprodução do áudio de alerta
function pararAudio() {
  if (audioAlerta) {
    if (audioAlerta.pause) {
      audioAlerta.pause();
      audioAlerta.currentTime = 0;
    }
    
    // Limpa geradores de tom
    if (audioAlerta._tongerador) {
      clearInterval(audioAlerta._tongerador);
      audioAlerta._tongerador = null;
    }
    
    if (audioAlerta._oscilador) {
      try {
        audioAlerta._oscilador.stop();
      } catch (e) {
        console.warn("Oscilador de alerta ja estava parado:", e);
      }
      audioAlerta._oscilador = null;
    }
  }
}

function atualizarVisibilidadeAlertas(alertas) {
  if (alertas.length === 0) {
    if (alertasVazio) alertasVazio.classList.remove("oculto");
    if (alertasContainer) alertasContainer.classList.add("oculto");
    if (alertasCorpo) alertasCorpo.innerHTML = "";
    return false;
  }

  if (alertasVazio) alertasVazio.classList.add("oculto");
  if (alertasContainer) alertasContainer.classList.remove("oculto");
  return true;
}

function popularTabelaAlertas(alertas) {
  if (!alertasCorpo) {
    return;
  }

  alertasCorpo.innerHTML = "";
  alertas.forEach((alerta) => {
    const linha = document.createElement("tr");

    const dataHora = new Date(alerta.data_hora);
    const dataFormatada = dataHora.toLocaleString("pt-BR");

    linha.innerHTML = `
      <td>${alerta.id}</td>
      <td>${alerta.usuario_nome || "N/A"}</td>
      <td>${alerta.usuario_local || "N/A"}</td>
      <td>${dataFormatada}</td>
      <td>
        <button class="btn-desativar" data-id="${alerta.id}">DESATIVAR</button>
      </td>
    `;

    alertasCorpo.appendChild(linha);
  });

  // Adiciona listeners aos botões de desativar
  document.querySelectorAll(".btn-desativar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      desativarAlerta(id);
    });
  });
}

// Busca alertas ativos do servidor
async function carregarAlertas() {
  try {
    const resposta = await fetch(`${API_BASE}/api/alertas/ativos`);
    
    if (!resposta.ok) {
      console.error("Erro ao buscar alertas:", resposta.status);
      mostrarMensagem("Erro ao carregar alertas", "erro");
      return;
    }

    const dados = await resposta.json();
    const alertas = dados.alertas || [];

    // Atualiza o total de alertas
    if (totalAlertasTexto) {
      const strong = totalAlertasTexto.querySelector("strong");
      if (strong) {
        strong.textContent = alertas.length;
      }
    }

    // Se houver alertas, toca o áudio
    if (alertas.length > 0) {
      iniciarAudio();
    } else {
      pararAudio();
    }

    // Mostra/esconde container vazio
    const haAlertas = atualizarVisibilidadeAlertas(alertas);
    if (!haAlertas) {
      return;
    }

    // Popula tabela
    popularTabelaAlertas(alertas);
  } catch (error_) {
    console.error("Erro ao carregar alertas:", error_);
    mostrarMensagem("Erro ao conectar com o servidor", "erro");
  }
}

function obterCorMensagem(tipo) {
  if (tipo === "sucesso") {
    return "#4CAF50";
  }

  if (tipo === "erro") {
    return "#f44336";
  }

  return "#2196F3";
}

// Desativa um alerta específico
async function desativarAlerta(id) {
  if (!confirm("Tem certeza que deseja desativar este alerta?")) {
    return;
  }

  try {
    const resposta = await fetch(`${API_BASE}/api/alertas/desativar/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!resposta.ok) {
      const erro = await resposta.json();
      mostrarMensagem(erro.erro || "Erro ao desativar alerta", "erro");
      return;
    }

    mostrarMensagem("Alerta desativado com sucesso", "sucesso");
    
    // Recarrega os alertas após desativar
    setTimeout(() => {
      carregarAlertas();
    }, 500);
  } catch (error_) {
    console.error("Erro ao desativar alerta:", error_);
    mostrarMensagem("Erro ao conectar com o servidor", "erro");
  }
}

// Mostra uma mensagem temporária ao usuário
function mostrarMensagem(texto, tipo = "info") {
  const corMensagem = obterCorMensagem(tipo);

  // Cria elemento de mensagem
  const mensagem = document.createElement("div");
  mensagem.className = `mensagem-flutuante mensagem-${tipo}`;
  mensagem.textContent = texto;
  mensagem.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${corMensagem};
    color: white;
    padding: 16px;
    border-radius: 4px;
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(mensagem);

  // Remove após 3 segundos
  setTimeout(() => {
    mensagem.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => mensagem.remove(), 300);
  }, 3000);
}

/* =============================
   Event Listeners
   ============================= */

// Volta para a página inicial
if (btnIrInicio) {
  btnIrInicio.addEventListener("click", () => {
    globalThis.location.href = "index.html";
  });
}

// Atualiza alertas manualmente
if (btnAtualizarAlertas) {
  btnAtualizarAlertas.addEventListener("click", () => {
    carregarAlertas();
  });
}

/* =============================
   Inicializacao
   ============================= */

// Ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  // Verifica se o usuário admin está logado
  const adminLogado = verificarAutenticacaoAdmin();
  
  if (!adminLogado) {
    mostrarMensagem("Acesso negado! Apenas administradores podem acessar este painel.", "erro");
    setTimeout(() => {
      globalThis.location.href = "index.html";
    }, 2000);
    return;
  }

  atualizarStatusLogin();
  carregarAlertas();

  // Atualiza alertas a cada 5 segundos
  setInterval(() => {
    carregarAlertas();
  }, 5000);
});

// Para o áudio quando sair da página
globalThis.addEventListener("beforeunload", () => {
  pararAudio();
});

// Para o áudio quando a aba ficar invisível
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Página ficou invisível, pode continuar tocando se quiser
    // ou parar. Aqui vamos deixar tocando para alertar o usuário
  }
});

// Verifica se há admin autenticado
function verificarAutenticacaoAdmin() {
  try {
    const admin = localStorage.getItem("sos_anjo_admin_logado");
    return admin ? JSON.parse(admin) : null;
  } catch (e) {
    console.warn("Nao foi possivel verificar autenticacao de admin:", e);
    return null;
  }
}
