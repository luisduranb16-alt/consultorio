'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Servicio {
  id: number;
  nombre: string;
  precio: number;
  precio_venta?: number;
  stock: number;
}

interface ItemCarrito {
  producto: Servicio;
  cantidad: number;
  subtotal: number;
}

interface AtencionMedica {
  id: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  total: number;
  metodo_pago?: string;
  fecha: string;
  tipo_comprobante?: string;
  cliente_documento?: string;
  cliente_nombre?: string;
}

export default function Home() {
  // 1. Estados de autenticación
  const [estaAutenticado, setEstaAutenticado] = useState(false);
  const [usuarioIngresado, setUsuarioIngresado] = useState('');
  const [claveIngresada, setClaveIngresada] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  const USUARIO_CORRECTO = 'doctor';
  const CLAVE_CORRECTA = 'salud2026';
  const NOMBRE_CLINICA = 'Consultorio Integral Barriguitas';

  const DATOS_EMPRESA = {
    razonSocial: 'CONSULTORIO INTEGRAL BARRIGUITAS',
    ruc: '20612345678',
    direccion: 'AV. SALUD Y VIDA NRO. 123 - LIMA',
    telefono: '987654321'
  };

  // Navegación e Inventario / Servicios
  const [pestanaActiva, setPestanaActiva] = useState<
    'venta' | 'reporte' | 'inventario' | 'producto' | 'caja'
  >('venta');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [atenciones, setAtenciones] = useState<AtencionMedica[]>([]);

  // POS / Carrito de Cobro
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [busquedaServicio, setBusquedaServicio] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [metodoPago, setMetodoPago] = useState<string>('Efectivo');
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  
  const [tipoComprobante, setTipoComprobante] = useState<'RECIBO' | 'PRESUPUESTO'>('RECIBO');
  const [documentoPaciente, setDocumentoPaciente] = useState('');
  const [nombrePaciente, setNombrePaciente] = useState('');
  const [comprobanteExitosaModal, setComprobanteExitosaModal] = useState<any | null>(null);

  function imprimirComprobante() {
    window.print();
  }
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  // Formulario nuevo servicio/medicamento
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('100');
  const [guardando, setGuardando] = useState(false);

  // Inventario y filtros
  const [filtroInventario, setFiltroInventario] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  // Edición rápida
  const [cantidadesAgregar, setCantidadesAgregar] = useState<{ [key: number]: string }>({});
  const [actualizandoStockId, setActualizandoStockId] = useState<number | null>(null);

  const [preciosNuevos, setPreciosNuevos] = useState<{ [key: number]: string }>({});
  const [actualizandoPrecioId, setActualizandoPrecioId] = useState<number | null>(null);

  const [nombresNuevos, setNombresNuevos] = useState<{ [key: number]: string }>({});
  const [actualizandoNombreId, setActualizandoNombreId] = useState<number | null>(null);

  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  // Caja y Cuadre
  const [efectivoEnCajon, setEfectivoEnCajon] = useState<string>('');
  const [filtroReporte, setFiltroReporte] = useState<'diario' | 'semanal' | 'mensual'>('diario');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function cerrarSesion() {
    setEstaAutenticado(false);
    setUsuarioIngresado('');
    setClaveIngresada('');
  }

  async function cargarDatos() {
    await Promise.all([obtenerServicios(), obtenerAtenciones()]);
  }

  async function obtenerServicios() {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      setServicios(data);
      const inicialesNombres: { [key: number]: string } = {};
      data.forEach((p) => {
        inicialesNombres[p.id] = p.nombre;
      });
      setNombresNuevos(inicialesNombres);
    }
  }

  async function obtenerAtenciones() {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false });

    if (!error && data) setAtenciones(data);
  }

  const serviciosFiltradosBusqueda = servicios.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busquedaServicio.toLowerCase()) ||
      p.id.toString().includes(busquedaServicio.trim())
  );

  const serviciosInventarioFiltrados = servicios.filter((p) => {
    const coincideTexto =
      p.nombre.toLowerCase().includes(filtroInventario.toLowerCase()) ||
      p.id.toString().includes(filtroInventario.trim());
    if (soloStockBajo) {
      return coincideTexto && p.stock <= 5;
    }
    return coincideTexto;
  });

  function agregarAlCarrito(producto: Servicio) {
    const itemExistente = carrito.find((i) => i.producto.id === producto.id);
    const precioUnitario = producto.precio || producto.precio_venta || 0;

    if (itemExistente) {
      setCarrito(
        carrito.map((i) =>
          i.producto.id === producto.id
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * precioUnitario }
            : i
        )
      );
    } else {
      setCarrito([...carrito, { producto, cantidad: 1, subtotal: precioUnitario }]);
    }

    setBusquedaServicio('');
    setMostrarSugerencias(false);
    inputBusquedaRef.current?.focus();
  }

  function actualizarCantidadCarrito(productoId: number, nuevaCantidad: number) {
    const item = carrito.find((i) => i.producto.id === productoId);
    if (!item) return;

    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(productoId);
      return;
    }

    const precioUnitario = item.producto.precio || item.producto.precio_venta || 0;

    setCarrito(
      carrito.map((i) =>
        i.producto.id === productoId
          ? { ...i, cantidad: nuevaCantidad, subtotal: nuevaCantidad * precioUnitario }
          : i
      )
    );
  }

  function eliminarDelCarrito(productoId: number) {
    setCarrito(carrito.filter((i) => i.producto.id !== productoId));
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + item.subtotal, 0);
  const vueltoCalculado =
    montoRecibido && parseFloat(montoRecibido) >= totalCarrito
      ? parseFloat(montoRecibido) - totalCarrito
      : 0;

  async function procesarComprobante() {
    if (carrito.length === 0) return alert('El carrito está vacío.');
    
    if (tipoComprobante === 'RECIBO' && metodoPago === 'Efectivo' && montoRecibido && parseFloat(montoRecibido) < totalCarrito) {
      return alert('El monto recibido es menor al total.');
    }

    setProcesandoVenta(true);

    try {
      const siguienteNumero = atenciones.length > 0 ? Math.max(...atenciones.map(v => v.id || 0)) + 1 : 1;
      const fechaActual = new Date().toISOString();
      const nombreTipoComprobante = tipoComprobante === 'RECIBO' ? 'RECIBO MÉDICO' : 'PRESUPUESTO';

      if (tipoComprobante === 'RECIBO') {
        for (const item of carrito) {
          // Descontar stock si aplica
          await supabase
            .from('productos')
            .update({ stock: Math.max(0, item.producto.stock - item.cantidad) })
            .eq('id', item.producto.id);

          const atencionData = {
            producto_id: item.producto.id,
            producto_nombre: item.producto.nombre,
            cantidad: item.cantidad,
            total: item.subtotal,
            metodo_pago: metodoPago,
            fecha: fechaActual,
            tipo_comprobante: nombreTipoComprobante,
            cliente_documento: documentoPaciente.trim() || '00000000',
            cliente_nombre: nombrePaciente.trim() || 'PACIENTE GENERAL',
            numero_ticket: siguienteNumero,
          };

          const { error: errorAtencion } = await supabase.from('ventas').insert([atencionData]);
          if (errorAtencion) throw new Error(`Error al registrar: ` + errorAtencion.message);
        }
      }

      const comprobanteInfo = {
        id: siguienteNumero, 
        fecha: fechaActual,
        tipo: nombreTipoComprobante,
        clienteDocumento: documentoPaciente.trim() || '00000000',
        clienteNombre: nombrePaciente.trim() || 'PACIENTE GENERAL',
        items: [...carrito],
        total: totalCarrito,
        metodoPago: metodoPago,
        vuelto: vueltoCalculado
      };

      setComprobanteExitosaModal(comprobanteInfo);
      setCarrito([]);
      setMontoRecibido('');
      setDocumentoPaciente('');
      setNombrePaciente('');
      if (tipoComprobante === 'RECIBO') {
        await cargarDatos();
      }
    } catch (err: any) {
      alert('Ocurrió un problema: ' + err.message);
    } finally {
      setProcesandoVenta(false);
    }
  }

  async function agregarServicioForm(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !precio) return;

    setGuardando(true);
    const precioNum = parseFloat(precio);
    const { error } = await supabase.from('productos').insert([
      {
        nombre: nombre.trim(),
        precio: precioNum,
        precio_venta: precioNum,
        stock: parseInt(stock, 10) || 100,
      },
    ]);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      alert('¡Servicio o producto registrado con éxito!');
      setNombre('');
      setPrecio('');
      setStock('100');
      await obtenerServicios();
      setPestanaActiva('inventario');
    }
    setGuardando(false);
  }

  async function sumarStock(producto: Servicio) {
    const cantidadASumarStr = cantidadesAgregar[producto.id];
    const cantidadASumar = parseInt(cantidadASumarStr, 10);

    if (isNaN(cantidadASumar) || cantidadASumar <= 0) {
      alert('Ingresa una cantidad válida mayor a 0.');
      return;
    }

    setActualizandoStockId(producto.id);
    const nuevoStock = producto.stock + cantidadASumar;

    const { error } = await supabase
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', producto.id);

    if (error) {
      alert('Error al actualizar: ' + error.message);
    } else {
      alert(`Se actualizaron las unidades de "${producto.nombre}". Stock: ${nuevoStock}`);
      setCantidadesAgregar((prev) => ({ ...prev, [producto.id]: '' }));
      await obtenerServicios();
    }
    setActualizandoStockId(null);
  }

  async function cambiarPrecio(producto: Servicio) {
    const precioNuevoStr = preciosNuevos[producto.id];
    const nuevoPrecio = parseFloat(precioNuevoStr);

    if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
      alert('Ingresa un precio válido.');
      return;
    }

    setActualizandoPrecioId(producto.id);
    const { error } = await supabase
      .from('productos')
      .update({ precio: nuevoPrecio, precio_venta: nuevoPrecio })
      .eq('id', producto.id);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert(`¡Precio actualizado a S/ ${nuevoPrecio.toFixed(2)}!`);
      await obtenerServicios();
    }
    setActualizandoPrecioId(null);
  }

  async function cambiarNombre(producto: Servicio) {
    const nuevoNombre = nombresNuevos[producto.id]?.trim();
    if (!nuevoNombre) return;

    setActualizandoNombreId(producto.id);
    const { error } = await supabase
      .from('productos')
      .update({ nombre: nuevoNombre })
      .eq('id', producto.id);

    if (!error) await obtenerServicios();
    setActualizandoNombreId(null);
  }

  async function eliminarServicio(producto: Servicio) {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    setEliminandoId(producto.id);
    await supabase.from('productos').delete().eq('id', producto.id);
    await obtenerServicios();
    setEliminandoId(null);
  }

  async function anularAtencion(atencion: AtencionMedica) {
    if (!confirm(`¿Anular el recibo de "${atencion.producto_nombre}"?`)) return;
    await supabase.from('ventas').delete().eq('id', atencion.id);
    await cargarDatos();
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  const atencionesHoy = atenciones.filter((v) => v.fecha && v.fecha.startsWith(hoyStr));
  const totalIngresosHoy = atencionesHoy.reduce((acc, v) => acc + Number(v.total), 0);
  const totalIngresosAcumulado = atenciones.reduce((acc, v) => acc + Number(v.total), 0);

  const desgloseMetodosHoy = atencionesHoy.reduce(
    (acc, v) => {
      const m = v.metodo_pago || 'Efectivo';
      acc[m] = (acc[m] || 0) + Number(v.total);
      return acc;
    },
    {} as { [key: string]: number }
  );

  const atencionesFiltradasPeriodo = atenciones.filter((venta) => {
    if (!venta.fecha) return false;
    const fechaVentaStr = venta.fecha.split('T')[0];
    const fechaVenta = new Date(fechaVentaStr + 'T00:00:00');
    const fechaFiltro = new Date(fechaSeleccionada + 'T00:00:00');

    if (filtroReporte === 'diario') {
      return fechaVentaStr === fechaSeleccionada;
    } else if (filtroReporte === 'semanal') {
      const diffTime = fechaFiltro.getTime() - fechaVenta.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    } else if (filtroReporte === 'mensual') {
      return (
        fechaVenta.getMonth() === fechaFiltro.getMonth() &&
        fechaVenta.getFullYear() === fechaFiltro.getFullYear()
      );
    }
    return true;
  });

  const totalVentasPeriodo = atencionesFiltradasPeriodo.reduce((acc, v) => acc + Number(v.total), 0);

  if (!estaAutenticado) {
    return (
      <div className="min-h-screen bg-teal-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
          <div className="text-center">
            <span className="text-4xl">🩺</span>
            <h1 className="text-2xl font-black text-teal-900 mt-2">Acceso al Consultorio</h1>
            <p className="text-xs text-slate-500 mt-1">Sistema de Caja y Gestión Médica</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                usuarioIngresado.trim() === USUARIO_CORRECTO &&
                claveIngresada.trim() === CLAVE_CORRECTA
              ) {
                setEstaAutenticado(true);
                setErrorLogin('');
              } else {
                setErrorLogin('Usuario o contraseña incorrectos');
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Usuario
              </label>
              <input
                type="text"
                required
                placeholder="Ej. doctor"
                value={usuarioIngresado}
                onChange={(e) => setUsuarioIngresado(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-lg text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={claveIngresada}
                onChange={(e) => setClaveIngresada(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-lg text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900"
              />
            </div>

            {errorLogin && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600 text-center">
                ⚠️ {errorLogin}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3 rounded-lg shadow-md transition text-sm uppercase tracking-wider"
            >
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-teal-900 text-white shadow-md border-b-4 border-teal-500">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🏥</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase text-teal-200">
                {NOMBRE_CLINICA}
              </h1>
              <p className="text-xs text-teal-300">Caja, Consultas y Recetario / Servicios</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-teal-950 px-4 py-2 rounded-lg border border-teal-800 text-center">
              <span className="block text-xs text-teal-300">Ingresos Hoy</span>
              <span className="text-lg font-bold text-emerald-400">
                S/ {totalIngresosHoy.toFixed(2)}
              </span>
            </div>

            <button
              onClick={cerrarSesion}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-3 rounded-lg transition shadow"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-slate-300 pb-2">
          <button
            onClick={() => setPestanaActiva('venta')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'venta'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            🩺 Facturación y Consultas
          </button>

          <button
            onClick={() => setPestanaActiva('caja')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'caja'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            💵 Cierre de Caja
          </button>

          <button
            onClick={() => setPestanaActiva('inventario')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'inventario'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            💊 Catálogo de Servicios / Insumos ({servicios.length})
          </button>

          <button
            onClick={() => setPestanaActiva('reporte')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'reporte'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            📊 Historial de Atenciones
          </button>

          <button
            onClick={() => setPestanaActiva('producto')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'producto'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            ➕ Nuevo Servicio / Ítem
          </button>
        </div>

        {pestanaActiva === 'venta' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border p-5 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b pb-3 flex justify-between items-center">
                <span>🔍 Buscar Consulta, Especialidad o Procedimiento</span>
              </h2>

              <div className="relative" ref={dropdownRef}>
                <input
                  ref={inputBusquedaRef}
                  type="text"
                  placeholder="Escribe el servicio médico o medicamento..."
                  value={busquedaServicio}
                  onChange={(e) => {
                    setBusquedaServicio(e.target.value);
                    setMostrarSugerencias(true);
                  }}
                  onFocus={() => setMostrarSugerencias(true)}
                  className="w-full border-2 border-slate-300 p-3 rounded-lg text-lg text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
                  autoFocus
                />

                {mostrarSugerencias && busquedaServicio.length > 0 && (
                  <ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {serviciosFiltradosBusqueda.length === 0 ? (
                      <li className="p-4 text-sm text-slate-500 text-center">
                        No se encontró ningún servicio registrado.
                      </li>
                    ) : (
                      serviciosFiltradosBusqueda.map((p) => (
                        <li
                          key={p.id}
                          onClick={() => agregarAlCarrito(p)}
                          className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between items-center transition"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{p.nombre}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-teal-800 block">
                              S/ {(p.precio || p.precio_venta || 0).toFixed(2)}
                            </span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Servicios y Consultas Frecuentes (Clic para agregar)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto p-1">
                  {servicios.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      className="p-3 text-left border rounded-lg hover:border-teal-500 hover:bg-teal-50/50 transition bg-slate-50 flex flex-col justify-between"
                    >
                      <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                        {p.nombre}
                      </span>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-teal-700">
                          S/ {(p.precio || p.precio_venta || 0).toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-center border-b pb-3">
                  <h2 className="text-lg font-bold text-slate-900">🧾 Detalle de la Atención</h2>
                  {carrito.length > 0 && (
                    <button
                      onClick={() => setCarrito([])}
                      className="text-xs text-red-600 hover:underline font-semibold"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="mt-4 max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {carrito.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <span className="text-4xl block mb-2">🩺</span>
                      <p className="text-sm">Ningún servicio agregado.</p>
                    </div>
                  ) : (
                    carrito.map((item) => (
                      <div key={item.producto.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {item.producto.nombre}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            S/ {(item.producto.precio || item.producto.precio_venta || 0).toFixed(2)} c/u
                          </p>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() =>
                              actualizarCantidadCarrito(item.producto.id, item.cantidad - 1)
                            }
                            className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) =>
                              actualizarCantidadCarrito(
                                item.producto.id,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-10 text-center text-xs font-bold border rounded py-0.5 text-slate-900"
                          />
                          <button
                            onClick={() =>
                              actualizarCantidadCarrito(item.producto.id, item.cantidad + 1)
                            }
                            className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded font-bold text-xs"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right w-16">
                          <span className="text-xs font-bold text-slate-900 block">
                            S/ {item.subtotal.toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() => eliminarDelCarrito(item.producto.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-xl">
                <div className="flex justify-between items-center text-slate-900">
                  <span className="text-sm font-bold">TOTAL A PAGAR:</span>
                  <span className="text-2xl font-black text-emerald-600">
                    S/ {totalCarrito.toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodoPago(m)}
                        className={`py-1.5 text-xs font-bold rounded border transition ${
                          metodoPago === m
                            ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {metodoPago === 'Efectivo' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Efectivo Recibido
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        placeholder="0.00"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        className="w-full border border-slate-300 p-2 rounded text-sm font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Vuelto
                      </label>
                      <div className="p-2 bg-white border rounded text-sm font-black text-blue-600 h-9 flex items-center">
                        S/ {vueltoCalculado.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoComprobante('RECIBO')}
                      className={`py-1.5 text-xs font-bold rounded border transition ${
                        tipoComprobante === 'RECIBO'
                          ? 'bg-teal-600 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      RECIBO / TICKET
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoComprobante('PRESUPUESTO')}
                      className={`py-1.5 text-xs font-bold rounded border transition ${
                        tipoComprobante === 'PRESUPUESTO'
                          ? 'bg-teal-600 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      PRESUPUESTO
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      DNI del Paciente
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="Número de DNI"
                      value={documentoPaciente}
                      onChange={(e) => setDocumentoPaciente(e.target.value)}
                      className="w-full border border-slate-300 p-2 rounded text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Nombre Completo del Paciente
                    </label>
                    <input
                      type="text"
                      placeholder="Apellidos y Nombres"
                      value={nombrePaciente}
                      onChange={(e) => setNombrePaciente(e.target.value)}
                      className="w-full border border-slate-300 p-2 rounded text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <button
                   onClick={procesarComprobante}                  
                   disabled={procesandoVenta || carrito.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-lg shadow-md transition disabled:opacity-50 text-base uppercase tracking-wide mt-2"
                 >
                   {procesandoVenta 
                   ? 'Procesando...' 
                   : tipoComprobante === 'RECIBO' 
                    ? '✓ COBRAR Y EMITIR RECIBO' 
                    : '📄 GENERAR PRESUPUESTO'}
                </button>
              </div>
            </div>
          </div>
        )}

        {pestanaActiva === 'caja' && (
          <div className="bg-white rounded-xl shadow-sm border max-w-4xl mx-auto overflow-hidden">
            <div className="p-5 bg-teal-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-teal-200">💵 Cierre y Cuadre de Caja Diaria</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2">
                  {(['diario', 'semanal', 'mensual'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroReporte(tipo)}
                      className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition ${
                        filtroReporte === tipo
                          ? 'bg-teal-600 text-white shadow'
                          : 'bg-white text-slate-700 border hover:bg-slate-100'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Fecha:</span>
                  <input
                    type="date"
                    value={fechaSeleccionada}
                    onChange={(e) => setFechaSeleccionada(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                  <span className="text-xs font-bold text-teal-900 uppercase">Ingresos Totales ({filtroReporte})</span>
                  <span className="text-2xl font-black text-teal-950 mt-1 block">
                    S/ {totalVentasPeriodo.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-xs font-bold text-emerald-900 uppercase">Atenciones Realizadas</span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">
                    {atencionesFiltradasPeriodo.length} pacientes
                  </span>
                </div>
              </div>

              <div className="border-t pt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">
                  Desglose por Método de Pago (Hoy)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-xs font-bold text-emerald-800 block">💵 Efectivo</span>
                    <span className="text-lg font-black text-emerald-900">
                      S/ {(desgloseMetodosHoy['Efectivo'] || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="text-xs font-bold text-purple-800 block">📱 Yape</span>
                    <span className="text-lg font-black text-purple-900">
                      S/ {(desgloseMetodosHoy['Yape'] || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
                    <span className="text-xs font-bold text-sky-800 block">📱 Plin</span>
                    <span className="text-lg font-black text-sky-900">
                      S/ {(desgloseMetodosHoy['Plin'] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pestanaActiva === 'inventario' && (
          <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Catálogo de Servicios y Procedimientos</h2>
              <input
                type="text"
                placeholder="Buscar servicio..."
                value={filtroInventario}
                onChange={(e) => setFiltroInventario(e.target.value)}
                className="border border-slate-300 px-3 py-2 rounded-lg text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-xs uppercase tracking-wider text-slate-600">
                    <th className="p-4">Servicio / Tratamiento</th>
                    <th className="p-4">Precio (S/)</th>
                    <th className="p-4 text-center">Modificar Precio</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {serviciosInventarioFiltrados.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium">{p.nombre}</td>
                      <td className="p-4 font-semibold text-teal-800">S/ {(p.precio || 0).toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            step="0.50"
                            placeholder="Nuevo S/"
                            value={preciosNuevos[p.id] || ''}
                            onChange={(e) => setPreciosNuevos({ ...preciosNuevos, [p.id]: e.target.value })}
                            className="w-24 border p-1.5 rounded text-sm"
                          />
                          <button
                            onClick={() => cambiarPrecio(p)}
                            className="bg-teal-600 text-white text-xs font-bold px-3 py-2 rounded"
                          >
                            Guardar
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => eliminarServicio(p)}
                          className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded border border-red-200"
                        >
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {pestanaActiva === 'reporte' && (
          <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Historial de Atenciones</h2>
              <div className="bg-emerald-100 text-emerald-800 font-bold text-sm px-4 py-1.5 rounded-full">
                Total acumulado: S/ {totalIngresosAcumulado.toFixed(2)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-xs uppercase tracking-wider text-slate-600">
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Paciente</th>
                    <th className="p-4">Servicio / Consulta</th>
                    <th className="p-4">Método Pago</th>
                    <th className="p-4">Total</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {atenciones.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="p-4 text-xs font-mono text-slate-500">
                        {new Date(v.fecha).toLocaleString('es-PE')}
                      </td>
                      <td className="p-4 font-medium">{v.cliente_nombre}</td>
                      <td className="p-4">{v.producto_nombre}</td>
                      <td className="p-4 font-semibold text-xs">{v.metodo_pago}</td>
                      <td className="p-4 font-bold text-emerald-600">S/ {Number(v.total).toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => anularAtencion(v)}
                          className="bg-red-50 text-red-600 border border-red-200 text-xs font-bold px-3 py-1.5 rounded"
                        >
                          Anular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {pestanaActiva === 'producto' && (
          <div className="bg-white rounded-xl shadow-sm border max-w-lg mx-auto overflow-hidden">
            <div className="p-5 bg-slate-50 border-b">
              <h2 className="text-xl font-bold text-slate-800">Registrar Nuevo Servicio o Medicamento</h2>
            </div>
            <form onSubmit={agregarServicioForm} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nombre del Servicio Médico o Tratamiento
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="Ej. Consulta Medicina General / Ecografía"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Precio (S/)
                </label>
                <input
                  type="number"
                  step="0.50"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={guardando}
                className="w-full bg-teal-900 hover:bg-teal-800 text-teal-200 font-bold py-3 rounded-lg shadow transition"
              >
                {guardando ? 'Guardando...' : '+ Registrar en el Sistema'}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* MODAL DE RECIBO / TICKET MÉDICO */}
      {comprobanteExitosaModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 print:shadow-none print:w-full print:max-w-none print:p-0">
            <div className="text-slate-900 space-y-3 font-mono text-xs border-b pb-4">
              <div className="text-center space-y-1">
                <h2 className="font-bold text-sm uppercase">{DATOS_EMPRESA.razonSocial}</h2>
                <p className="text-[10px]">RUC: {DATOS_EMPRESA.ruc}</p>
                <p className="text-[10px]">{DATOS_EMPRESA.direccion}</p>
                <div className="border-t border-dashed my-2"></div>
                <p className="font-bold uppercase text-sm bg-slate-100 py-1">
                  {comprobanteExitosaModal.tipo}
                </p>
                <p className="font-bold">N°: 001-{comprobanteExitosaModal.id}</p>
                <p className="text-[10px]">Fecha: {new Date(comprobanteExitosaModal.fecha).toLocaleString('es-PE')}</p>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1 text-[11px]">
                <p><strong>Paciente:</strong> {comprobanteExitosaModal.clienteNombre}</p>
                <p><strong>DNI:</strong> {comprobanteExitosaModal.clienteDocumento}</p>
                <p><strong>Método de Pago:</strong> {comprobanteExitosaModal.metodoPago}</p>
              </div>

              <div className="border-t border-dashed pt-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-[10px]">
                      <th className="pb-1">Servicio / Descripción</th>
                      <th className="pb-1 text-right">Cant.</th>
                      <th className="pb-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed text-[11px]">
                    {comprobanteExitosaModal.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-1">{item.producto?.nombre}</td>
                        <td className="py-1 text-right">{item.cantidad}</td>
                        <td className="py-1 text-right">S/ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-dashed pt-2 text-right">
                <p className="text-sm font-bold">TOTAL: S/ {comprobanteExitosaModal.total.toFixed(2)}</p>
              </div>

              <div className="text-center pt-3 text-[10px] text-slate-500">
                <p>¡Gracias por su confianza en su salud!</p>
              </div>
            </div>

            <div className="flex gap-3 print:hidden">
              <button
                onClick={imprimirComprobante}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 rounded-lg text-xs uppercase tracking-wider"
              >
                🖨️ Imprimir Recibo
              </button>
              <button
                onClick={() => setComprobanteExitosaModal(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2.5 rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}