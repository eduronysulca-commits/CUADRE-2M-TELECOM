
const API_URL = "https://script.google.com/macros/s/AKfycbwVP-bEBSZS6i_jFCVWtTicStkbXqMyrOdOlplJ1nK_HJ8KvKVwyaLDt0MWqEtJ3IwORQ/exec";

const $ = id => document.getElementById(id);
const CLAVE_BORRADOR = "2mTelecom_borradorCuadre_v1";

let registrosAnteriores = [];
let temporizadorBorrador;
let cargandoSaldos = false;

const dinero = valor =>
  "S/ " + (Number(valor) || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const numero = id => Number($(id)?.value || 0);

function fechaDeHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function poner(id, valor) {
  const elemento = $(id);
  if (elemento) elemento.value = valor ?? 0;
}

function mostrar(id, valor) {
  const elemento = $(id);
  if (elemento) elemento.textContent = valor;
}

function mensaje(id, texto) {
  mostrar(id, texto);
}

function guardarBorrador() {
  try {
    const datos = {};

    document.querySelectorAll("input, select, textarea").forEach(campo => {
      if (campo.id) datos[campo.id] = campo.value;
    });

    datos.celulares = obtenerCelulares();

    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(datos));
  } catch (error) {
    console.warn("No se pudo guardar el borrador", error);
  }
}

function programarBorrador() {
  clearTimeout(temporizadorBorrador);
  temporizadorBorrador = setTimeout(guardarBorrador, 300);
}


function restaurarBorrador() {
  try {
    const guardado = localStorage.getItem(CLAVE_BORRADOR);

    if (!guardado) return false;

    const datos = JSON.parse(guardado);

    document.querySelectorAll("input, select, textarea").forEach(campo => {
      if (campo.id && Object.hasOwn(datos, campo.id)) {
        campo.value = datos[campo.id];
      }
    });

    if (Array.isArray(datos.celulares) && $("filasCelulares")) {
      $("filasCelulares").replaceChildren();

      datos.celulares.forEach(c => {
        agregarCelular(c.modelo, c.precio, c.cantidad);
      });
    }

    return true;
  } catch (error) {
    console.warn("No se pudo restaurar el borrador", error);
    return false;
  }
}


function solicitarJSONP(parametros) {
  return new Promise((resolve, reject) => {
    const callback = "jsonp_" + Date.now() + "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    const consulta = new URLSearchParams({ ...parametros, callback });

    const temporizador = setTimeout(() => {
      limpiar();
      reject(new Error("Tiempo de espera agotado."));
    }, 20000);

    function limpiar() {
      clearTimeout(temporizador);
      delete window[callback];
      script.remove();
    }

    window[callback] = respuesta => {
      limpiar();
      resolve(respuesta);
    };

    script.onerror = () => {
      limpiar();
      reject(new Error("No se pudo conectar con Google Sheets."));
    };

    script.src = `${API_URL}?${consulta.toString()}`;
    document.body.appendChild(script);
  });
}

// =====================================================
// CAJA HUK
// =====================================================


function calcular() {
  // IMPORTES INICIALES
  const efectivoInicial = numero("efectivoInicial");
  const bolsaInicial = numero("bolsaInicial");
  const recargasInicial = numero("recargasInicial");

  // GANANCIAS Y GASTOS
  const gananciaRecaudo = numero("gananciaRecaudo");
  const gananciaRecargas = numero("gananciaRecargas");
  const gastosHuk = numero("gastosHuk");

  // IMPORTES DE CIERRE
  const efectivoCierre = numero("efectivoCierre");
  const bolsaCierre = numero("bolsaCierre");
  const recargasCierre = numero("recargasCierre");

  // 1. CAPITAL INICIAL
  const capitalInicial =
    efectivoInicial + bolsaInicial + recargasInicial;

  // 2. CAPITAL ESPERADO:
  // Los gastos HUK se SUMAN.
  // Las ganancias de recaudo y recargas se RESTAN.
  const capitalEsperado =
    capitalInicial
    - gastosHuk
    + gananciaRecaudo
    + gananciaRecargas;

  // 3. CAPITAL REAL DEL CIERRE
  const capitalReal =
    efectivoCierre + bolsaCierre + recargasCierre;

  // 4. DIFERENCIA FINAL
  const diferencia = capitalReal - capitalEsperado;

  // 5. MOSTRAR RESULTADOS
  mostrar("capitalInicial", dinero(capitalInicial));
  mostrar("resGastosHuk", dinero(gastosHuk));
  mostrar("resGananciaRecaudo", dinero(gananciaRecaudo));
  mostrar("resGananciaRecargas", dinero(gananciaRecargas));
  mostrar("capitalEsperado", dinero(capitalEsperado));
  mostrar("capitalReal", dinero(capitalReal));
  mostrar("diferencia", dinero(diferencia));
  mostrar("resCapitalReal", dinero(capitalReal));
  mostrar("resDiferencia", dinero(diferencia));

  // 6. ESTADO DEL CUADRE
  const estado = $("estadoHuk");

  if (estado) {
    estado.textContent =
      Math.abs(diferencia) < 0.01
        ? "CUADRADO"
        : "CON DIFERENCIA";
  }
}


function calcularChips() {
  const casi = numero("casi");
  const prepago = numero("prepago");
  const pospago = numero("pospago");
  const yape = numero("yapeChips");

  // Cantidad total de chips
  const cantidad = casi + prepago + pospago;

  // Calcular importes según el precio de cada chip
  const total = (casi * 10) + (prepago * 5) + (pospago * 1);

  // Restar Yape para obtener el efectivo
  const efectivo = total - yape;

  mostrar("cantidadChips", cantidad);
  mostrar("resTotalChips", dinero(total));
  mostrar("resYapeChips", dinero(yape));
  mostrar("efectivoChips", dinero(efectivo));
  mostrar("resEfectivoChips", dinero(efectivo));

  const estado = $("estadoChips");
  if (estado) {
    estado.textContent = "TOTAL: " + cantidad + " chips";
  }
}





function agregarCelular(modelo = "", precio = 0, cantidad = 1) {
  const contenedor = $("filasCelulares");
  if (!contenedor) return;

  const fila = document.createElement("tr");

  fila.innerHTML = `
    <td><input class="cel-modelo" type="text" placeholder="Modelo"></td>
    <td><input class="cel-precio" type="number" min="0" step="0.01"></td>
    <td><input class="cel-cantidad" type="number" min="0" step="1"></td>
    <td class="cel-total">S/ 0.00</td>
    <td><button type="button" class="button light cel-eliminar">×</button></td>
  `;

  fila.querySelector(".cel-modelo").value = modelo;
  fila.querySelector(".cel-precio").value = precio;
  fila.querySelector(".cel-cantidad").value = cantidad;

  fila.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", calcularCelulares);
  });

  fila.querySelector(".cel-eliminar").addEventListener("click", () => {
    fila.remove();
    calcularCelulares();
  });

  contenedor.appendChild(fila);
  calcularCelulares();
}

function obtenerCelulares() {
  return [...document.querySelectorAll("#filasCelulares tr")].map(fila => ({
    modelo: fila.querySelector(".cel-modelo")?.value.trim() || "",
    precio: Number(fila.querySelector(".cel-precio")?.value || 0),
    cantidad: Number(fila.querySelector(".cel-cantidad")?.value || 0)
  }));
}

function calcularCelulares() {
  let total = 0;

  document.querySelectorAll("#filasCelulares tr").forEach(fila => {
    const precio = Number(fila.querySelector(".cel-precio")?.value || 0);
    const cantidad = Number(fila.querySelector(".cel-cantidad")?.value || 0);
    const subtotal = precio * cantidad;

    total += subtotal;

    const celda = fila.querySelector(".cel-total");
    if (celda) celda.textContent = dinero(subtotal);
  });

  const yape = numero("yapeCelulares");
  const efectivo = total - yape;

  mostrar("totalCelulares", dinero(total));
  mostrar("resYapeCelulares", dinero(yape));
  mostrar("efectivoCelulares", dinero(efectivo));
  mostrar("resEfectivoCelulares", dinero(efectivo));

  const estado = $("estadoCelulares");
  if (estado) {
    estado.textContent = total > 0
      ? "TOTAL CELULARES: " + dinero(total)
      : "AGREGA LOS CELULARES DEL DÍA";
  }

  programarBorrador();
}

// =====================================================
// SALDOS INICIALES DEL DÍA ANTERIOR
// =====================================================

async function cargarSaldosIniciales() {
  const fecha = $("fecha")?.value;
  if (!fecha || cargandoSaldos) return;

  cargandoSaldos = true;

  try {
    const respuesta = await solicitarJSONP({
      accion: "saldosIniciales",
      fecha
    });

    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || "No se pudieron consultar los saldos.");
    }

    if (respuesta.encontrado) {
      poner("efectivoInicial", respuesta.efectivoInicial);
      poner("bolsaInicial", respuesta.bolsaInicial);
      poner("recargasInicial", respuesta.recargasInicial);

      calcular();
      guardarBorrador();

      console.log("Saldos copiados del día:", respuesta.fechaAnterior);
    } else {
      console.log("No se encontró un cuadre anterior para la fecha elegida.");
    }
  } catch (error) {
    console.error("Error al cargar los saldos iniciales:", error);
  } finally {
    cargandoSaldos = false;
  }
}

// =====================================================
// GUARDAR CUADRE EN GOOGLE SHEETS
// =====================================================

async function guardarCuadre() {
  const boton = $("guardar");
  if (boton) boton.disabled = true;

  const payload = {
    accion: "guardar",
    fecha: $("fecha")?.value || fechaDeHoy(),

    efectivoInicial: numero("efectivoInicial"),
    bolsaInicial: numero("bolsaInicial"),
    recargasInicial: numero("recargasInicial"),

    gananciaRecaudo: numero("gananciaRecaudo"),
    gananciaRecargas: numero("gananciaRecargas"),
    gastosHuk: numero("gastosHuk"),

    efectivoCierre: numero("efectivoCierre"),
    bolsaCierre: numero("bolsaCierre"),
    recargasCierre: numero("recargasCierre"),

    capitalInicial:
      numero("efectivoInicial") +
      numero("bolsaInicial") +
      numero("recargasInicial"),

    capitalEsperado:
      numero("efectivoInicial") +
      numero("bolsaInicial") +
      numero("recargasInicial") +
      numero("gastosHuk") -
      numero("gananciaRecaudo") -
      numero("gananciaRecargas"),

    capitalReal:
      numero("efectivoCierre") +
      numero("bolsaCierre") +
      numero("recargasCierre"),

    diferencia:
      numero("efectivoCierre") +
      numero("bolsaCierre") +
      numero("recargasCierre") -
      (
        numero("efectivoInicial") +
        numero("bolsaInicial") +
        numero("recargasInicial") +
        numero("gastosHuk") -
        numero("gananciaRecaudo") -
        numero("gananciaRecargas")
      ),

    estadoHuk:
      Math.abs(
        numero("efectivoCierre") +
        numero("bolsaCierre") +
        numero("recargasCierre") -
        (
          numero("efectivoInicial") +
          numero("bolsaInicial") +
          numero("recargasInicial") +
          numero("gastosHuk") -
          numero("gananciaRecaudo") -
          numero("gananciaRecargas")
        )
      ) < 0.005 ? "Cuadrada" : "Con diferencia",

    casi: numero("casi"),
    prepago: numero("prepago"),
    pospago: numero("pospago"),
    cantidadChips: numero("casi") + numero("prepago") + numero("pospago"),
    totalChips: numero("totalChips"),
    yapeChips: numero("yapeChips"),
    efectivoChips: numero("totalChips") - numero("yapeChips"),

    yapeCelulares: numero("yapeCelulares"),
    totalCelulares: obtenerCelulares().reduce(
      (suma, c) => suma + c.precio * c.cantidad, 0
    ),
    efectivoCelulares:
      obtenerCelulares().reduce((suma, c) => suma + c.precio * c.cantidad, 0)
      - numero("yapeCelulares"),

    celulares: obtenerCelulares().filter(c => c.modelo || c.precio || c.cantidad)
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    mensaje("mensajeGuardado",
      "Solicitud enviada. Comprueba el registro en Google Sheets antes de volver a guardarlo.");

    localStorage.removeItem(CLAVE_BORRADOR);

    // No se afirma que el servidor guardó el cuadre:
    // no-cors no permite leer su respuesta.
  } catch (error) {
    console.error(error);
    mensaje("mensajeGuardado", "Error de conexión. Intenta nuevamente.");
  } finally {
    if (boton) boton.disabled = false;
  }
}

// =====================================================
// BUSCAR Y MOSTRAR HISTORIAL
// =====================================================

async function cargarHistorial2M() {
  const cuerpo = $("filasHistorial");
  const texto = $("mensajeHistorial");

  if (cuerpo) cuerpo.replaceChildren();
  mensaje("mensajeHistorial", "Buscando cuadres...");

  try {
    const respuesta = await solicitarJSONP({
      accion: "historial",
      desde: $("histDesde")?.value || "",
      hasta: $("histHasta")?.value || "",
      estado: $("histEstado")?.value || "todos"
    });

    if (!respuesta || respuesta.ok !== true) {
      throw new Error(respuesta?.mensaje || "No se pudo obtener el historial.");
    }

    registrosAnteriores = respuesta.registros || [];
    mostrarHistorial2M(registrosAnteriores);

    mensaje("mensajeHistorial",
      `Se encontraron ${registrosAnteriores.length} cuadre(s).`);
  } catch (error) {
    console.error("Error al buscar historial:", error);
    mensaje("mensajeHistorial", "Error al buscar: " + error.message);
  }
}

function mostrarHistorial2M(registros) {
  const cuerpo = $("filasHistorial");
  if (!cuerpo) return;

  cuerpo.replaceChildren();

  if (!registros.length) {
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = 5;
    celda.textContent = "No se encontraron cuadres.";
    fila.appendChild(celda);
    cuerpo.appendChild(fila);
    return;
  }

  registros.forEach(registro => {
    const fila = document.createElement("tr");
    const diferencia = Number(registro.Diferencia) || 0;
    const cuadrada = Math.abs(diferencia) < 0.005;

    const valores = [
      registro.Fecha || "",
      dinero(registro.CapitalReal),
      dinero(diferencia),
      cuadrada ? "Cuadrada" : "Con diferencia"
    ];

    valores.forEach(valor => {
      const celda = document.createElement("td");
      celda.textContent = valor;
      fila.appendChild(celda);
    });

    const celdaAccion = document.createElement("td");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "button light";
    boton.textContent = "Ver detalle";
    boton.addEventListener("click", () => verDetalle2M(registro.ID));

    celdaAccion.appendChild(boton);
    fila.appendChild(celdaAccion);
    cuerpo.appendChild(fila);
  });
}

// =====================================================
// DETALLE DE UN CUADRE ANTERIOR
// =====================================================

async function verDetalle2M(id) {
  try {
    const respuesta = await solicitarJSONP({ accion: "detalle", id });

    if (!respuesta || !respuesta.ok) {
      throw new Error(respuesta?.mensaje || "No se pudo cargar el detalle.");
    }

    const registro = registrosAnteriores.find(
      r => String(r.ID) === String(id)
    );

    const panel = $("detalleHistorico");
    if (panel) panel.hidden = false;

    mostrar("fechaDetalleHistorico",
      "Fecha del cuadre: " + (registro?.Fecha || ""));

    const resumen = $("resumenDetalleHistorico");
    if (resumen) {
      resumen.replaceChildren();

      const campos = [
        ["Efectivo inicial", "EfectivoInicial"],
        ["Bolsa inicial", "BolsaInicial"],
        ["Recargas inicial", "RecargasInicial"],
        ["Ganancia recaudo", "GananciaRecaudo"],
        ["Ganancia recargas", "GananciaRecargas"],
        ["Gastos HUK", "GastosHuk"],
        ["Efectivo cierre", "EfectivoCierre"],
        ["Bolsa cierre", "BolsaCierre"],
        ["Recargas cierre", "RecargasCierre"],
        ["Capital esperado", "CapitalEsperado"],
        ["Capital real", "CapitalReal"],
        ["Diferencia", "Diferencia"],
        ["Total chips", "TotalChips"],
        ["Yape chips", "YapeChips"],
        ["Total celulares", "TotalCelulares"],
        ["Yape celulares", "YapeCelulares"]
      ];

      campos.forEach(([etiqueta, clave]) => {
        const bloque = document.createElement("div");
        const titulo = document.createElement("span");
        const valor = document.createElement("strong");

        titulo.textContent = etiqueta;
        valor.textContent = dinero(registro?.[clave]);

        bloque.append(titulo, valor);
        resumen.appendChild(bloque);
      });
    }

    const cuerpo = $("filasDetalleHistorico");
    if (cuerpo) {
      cuerpo.replaceChildren();

      (respuesta.celulares || []).forEach(celular => {
        const fila = document.createElement("tr");

        [
          celular.modelo,
          dinero(celular.precio),
          celular.cantidad,
          dinero(celular.total)
        ].forEach(valor => {
          const celda = document.createElement("td");
          celda.textContent = valor ?? "";
          fila.appendChild(celda);
        });

        cuerpo.appendChild(fila);
      });
    }

    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    alert("No se pudo abrir el detalle: " + error.message);
  }
}

// =====================================================
// INICIALIZACIÓN
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  if (!$("fecha").value) poner("fecha", fechaDeHoy());

  restaurarBorrador();

  $("fecha")?.addEventListener("change", cargarSaldosIniciales);

document.querySelectorAll("input, select, textarea").forEach(campo => {
  campo.addEventListener("input", () => {
    calcular();
    programarBorrador();
  });

  campo.addEventListener("change", () => {
    calcular();
    programarBorrador();
  });
});

// Guardar también los cambios en filas agregadas dinámicamente
document.addEventListener("input", evento => {
  if (evento.target.matches("input, select, textarea")) {
    programarBorrador();
  }
});

document.addEventListener("change", evento => {
  if (evento.target.matches("input, select, textarea")) {
    programarBorrador();
  }
});

 
  $("agregarCelular")?.addEventListener("click", () => agregarCelular());
  // ACTUALIZAR EFECTIVO CUANDO CAMBIE EL YAPE DE CELULARES
$("yapeCelulares")?.addEventListener("input", calcularCelulares);
$("yapeCelulares")?.addEventListener("change", calcularCelulares);

  $("guardar")?.addEventListener("click", guardarCuadre);

  $("buscarHistorial")?.addEventListener("click", cargarHistorial2M);
  $("actualizarHistorial")?.addEventListener("click", cargarHistorial2M);

  $("histDesde")?.addEventListener("change", cargarHistorial2M);
  $("histHasta")?.addEventListener("change", cargarHistorial2M);
  $("histEstado")?.addEventListener("change", cargarHistorial2M);

  $("cerrarDetalleHistorico")?.addEventListener("click", () => {
    const panel = $("detalleHistorico");
    if (panel) panel.hidden = true;
  });

  $("limpiar")?.addEventListener("click", () => {
    if (!confirm("¿Deseas limpiar los datos del formulario?")) return;

    document.querySelectorAll("input").forEach(campo => {
      if (campo.id !== "fecha" && campo.type !== "date") campo.value = 0;
    });

    poner("fecha", fechaDeHoy());
    $("filasCelulares")?.replaceChildren();
    agregarCelular();
    localStorage.removeItem(CLAVE_BORRADOR);
    calcular();
  });

  $("imprimir")?.addEventListener("click", () => window.print());

  if (!$("filasCelulares")?.children.length) {
    agregarCelular();
  }

  calcular();
  cargarSaldosIniciales();
  cargarHistorial2M();
});

document.addEventListener("DOMContentLoaded", function () {
  ["casi", "prepago", "pospago", "yapeChips"].forEach(function (id) {
    const campo = document.getElementById(id);

    if (campo) {
      campo.addEventListener("input", calcularChips);
      campo.addEventListener("change", calcularChips);
    }
  });

  calcularChips();
});
function calcularDesgloseEfectivo(actualizarCierre = true) {
  let totalCentimos = 0;

  document.querySelectorAll(".cantidad-efectivo").forEach(campo => {
    // Lo que escribes es el monto en soles de esa fila
    const montoCentimos = Math.max(0, Math.round((Number(campo.value) || 0) * 100));

    totalCentimos += montoCentimos;

    // billete100 -> subtotal100, moneda050 -> subtotal050
    const sufijo = campo.id.replace("billete", "").replace("moneda", "");
    mostrar("subtotal" + sufijo, "S/ " + (montoCentimos / 100).toFixed(2));
  });

  const total = totalCentimos / 100;

  mostrar("totalEfectivoContado", "S/ " + total.toFixed(2));

  // Pasar el total a Efectivo cierre de CAJA HUK
  if (actualizarCierre) {
    const efectivoCierre = $("efectivoCierre");

    if (efectivoCierre) {
      efectivoCierre.value = total.toFixed(2);
      efectivoCierre.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

// Al escribir en una fila: calcula y actualiza Efectivo cierre
document.addEventListener("input", evento => {
  if (evento.target.matches(".cantidad-efectivo")) {
    calcularDesgloseEfectivo(true);
  }
});

// Al abrir la página: solo muestra los subtotales (no toca Efectivo cierre)
document.addEventListener("DOMContentLoaded", () => {
  calcularDesgloseEfectivo(false);
});

// Al presionar "Limpiar datos": refresca los subtotales del desglose
document.addEventListener("DOMContentLoaded", () => {
  $("limpiar")?.addEventListener("click", () => {
    calcularDesgloseEfectivo(false);
  });
});
