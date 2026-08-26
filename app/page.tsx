'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  precio_venta?: number;
  stock: number;
}

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  subtotal: number;
}

interface Venta {
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

  const USUARIO_CORRECTO = 'admin';
  const CLAVE_CORRECTA = '123456';
  const NOMBRE_FERRETERIA = 'Servicios Generales GYT';

// Agrega tus datos fiscales
  const DATOS_EMPRESA = {
    razonSocial: 'SERVICIOS GENERALES G Y T E.I.R.L.', // O tu nombre si estás como Persona Natural con Negocio
    ruc: '20611908513', // Reemplaza con tu RUC real
    direccion: 'NRO. S/N URB. SAN JUAN (FRENTE AL SITIO ARQUEOLÓGICO VICHAMA) LIMA - HUAURA - VEGUETA',
    telefono: '982839411'
  };

  // Navegación e Inventario
  const [pestanaActiva, setPestanaActiva] = useState<
    'venta' | 'reporte' | 'inventario' | 'producto' | 'caja'
  >('venta');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  // POS / Carrito
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [metodoPago, setMetodoPago] = useState<string>('Efectivo');
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  
  const [tipoComprobante, setTipoComprobante] = useState<'TICKET' | 'PROFORMA'>('TICKET');
  const [documentoCliente, setDocumentoCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [ventaExitosaModal, setVentaExitosaModal] = useState<any | null>(null);
  function imprimirComprobante() {
    window.print();
  }
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  // Formulario nuevo producto
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Inventario y filtros
  const [filtroInventario, setFiltroInventario] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  // Edición rápida en Inventario
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

  // Cierra el menú desplegable al hacer clic fuera
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
    await Promise.all([obtenerProductos(), obtenerVentas()]);
  }

  async function obtenerProductos() {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      setProductos(data);
      const inicialesNombres: { [key: number]: string } = {};
      data.forEach((p) => {
        inicialesNombres[p.id] = p.nombre;
      });
      setNombresNuevos(inicialesNombres);
    }
  }

  async function obtenerVentas() {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false });

    if (!error && data) setVentas(data);
  }

  const productosFiltradosBusqueda = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
      p.id.toString().includes(busquedaProducto.trim())
  );

  const productosInventarioFiltrados = productos.filter((p) => {
    const coincideTexto =
      p.nombre.toLowerCase().includes(filtroInventario.toLowerCase()) ||
      p.id.toString().includes(filtroInventario.trim());
    if (soloStockBajo) {
      return coincideTexto && p.stock <= 5;
    }
    return coincideTexto;
  });

  // Lógica del Carrito
  function agregarAlCarrito(producto: Producto) {
    if (producto.stock <= 0) {
      alert(`El producto "${producto.nombre}" está agotado.`);
      return;
    }

    const itemExistente = carrito.find((i) => i.producto.id === producto.id);
    const precioUnitario = producto.precio || producto.precio_venta || 0;

    if (itemExistente) {
      if (itemExistente.cantidad + 1 > producto.stock) {
        alert(`No hay suficiente stock. Máximo disponible: ${producto.stock}`);
        return;
      }
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

    setBusquedaProducto('');
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

    if (nuevaCantidad > item.producto.stock) {
      alert(`Stock máximo disponible para ${item.producto.nombre}: ${item.producto.stock}`);
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

  async function finalizarVentaMultiProducto() {
    if (carrito.length === 0) return alert('El carrito está vacío.');
    if (metodoPago === 'Efectivo' && montoRecibido && parseFloat(montoRecibido) < totalCarrito) {
      return alert('El monto recibido es menor al total de la venta.');
    }

    setProcesandoVenta(true);

    try {
      const siguienteNumeroTicket = ventas.length > 0 ? Math.max(...ventas.map(v => v.id || 0)) + 1 : 1;
      const fechaActual = new Date().toISOString();

      for (const item of carrito) {
        const { error: errorStock } = await supabase
          .from('productos')
          .update({ stock: item.producto.stock - item.cantidad })
          .eq('id', item.producto.id);

        if (errorStock) throw new Error(`Error en stock (${item.producto.nombre}): ` + errorStock.message);

        const ventaData = {
          producto_id: item.producto.id,
          producto_nombre: item.producto.nombre,
          cantidad: item.cantidad,
          total: item.subtotal,
          metodo_pago: metodoPago,
          fecha: fechaActual,
          tipo_comprobante: 'TICKET DE VENTA',
          cliente_documento: documentoCliente.trim() || '00000000',
          cliente_nombre: nombreCliente.trim() || 'CLIENTE GENERAL',
          numero_ticket: siguienteNumeroTicket,
        };

        const { error: errorVenta } = await supabase.from('ventas').insert([ventaData]);
        if (errorVenta) throw new Error(`Error en venta: ` + errorVenta.message);
      }

      // Estructura para mostrar el ticket visual/impresión
      const ticketInfo = {
        id: siguienteNumeroTicket, 
        fecha: fechaActual,
        tipo: 'TICKET DE VENTA',
        clienteDocumento: documentoCliente.trim() || '00000000',
        clienteNombre: nombreCliente.trim() || 'CLIENTE GENERAL',
        items: [...carrito],
        total: totalCarrito,
        metodoPago: metodoPago,
        vuelto: vueltoCalculado
      };

      setVentaExitosaModal(ticketInfo);
      setCarrito([]);
      setMontoRecibido('');
      setDocumentoCliente('');
      setNombreCliente('');
      await cargarDatos();
    } catch (err: any) {
      alert('Ocurrió un problema: ' + err.message);
    } finally {
      setProcesandoVenta(false);
    }
  }

  async function agregarProducto(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !precio || !stock) return;

    setGuardando(true);
    const precioNum = parseFloat(precio);
    const { error } = await supabase.from('productos').insert([
      {
        nombre: nombre.trim(),
        precio: precioNum,
        precio_venta: precioNum,
        stock: parseInt(stock, 10),
      },
    ]);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      alert('¡Producto registrado con éxito!');
      setNombre('');
      setPrecio('');
      setStock('');
      await obtenerProductos();
      setPestanaActiva('inventario');
    }
    setGuardando(false);
  }

  async function sumarStock(producto: Producto) {
    const cantidadASumarStr = cantidadesAgregar[producto.id];
    const cantidadASumar = parseInt(cantidadASumarStr, 10);

    if (isNaN(cantidadASumar) || cantidadASumar <= 0) {
      alert('Ingresa una cantidad válida mayor a 0 para agregar al stock.');
      return;
    }

    setActualizandoStockId(producto.id);
    const nuevoStock = producto.stock + cantidadASumar;

    const { error } = await supabase
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', producto.id);

    if (error) {
      alert('Error al actualizar el stock: ' + error.message);
    } else {
      alert(`Se agregaron ${cantidadASumar} unidades a "${producto.nombre}". Nuevo stock: ${nuevoStock}`);
      setCantidadesAgregar((prev) => ({ ...prev, [producto.id]: '' }));
      await obtenerProductos();
    }

    setActualizandoStockId(null);
  }

  async function cambiarPrecio(producto: Producto) {
    const precioNuevoStr = preciosNuevos[producto.id];
    const nuevoPrecio = parseFloat(precioNuevoStr);

    if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
      alert('Ingresa un precio válido mayor a 0.');
      return;
    }

    setActualizandoPrecioId(producto.id);

    const { data, error } = await supabase
      .from('productos')
      .update({ precio: nuevoPrecio, precio_venta: nuevoPrecio })
      .eq('id', producto.id)
      .select();

    if (error) {
      alert('Error de Supabase: ' + error.message);
      setActualizandoPrecioId(null);
      return;
    }

    if (!data || data.length === 0) {
      alert('⚠️ Supabase rechazó el cambio (0 filas actualizadas). Revisa las políticas RLS.');
      setActualizandoPrecioId(null);
      return;
    }

    setProductos((prev) =>
      prev.map((item) =>
        item.id === producto.id ? { ...item, precio: nuevoPrecio, precio_venta: nuevoPrecio } : item
      )
    );

    setPreciosNuevos((prev) => ({ ...prev, [producto.id]: '' }));
    alert(`¡Éxito! Precio de "${producto.nombre}" cambiado a S/ ${nuevoPrecio.toFixed(2)}`);
    setActualizandoPrecioId(null);
  }

  async function cambiarNombre(producto: Producto) {
    const nuevoNombre = nombresNuevos[producto.id]?.trim();

    if (!nuevoNombre) {
      alert('El nombre o descripción no puede estar vacío.');
      return;
    }

    if (nuevoNombre === producto.nombre) {
      alert('El nombre ingresado es idéntico al actual.');
      return;
    }

    setActualizandoNombreId(producto.id);

    const { error } = await supabase
      .from('productos')
      .update({ nombre: nuevoNombre })
      .eq('id', producto.id);

    if (error) {
      alert('Error al actualizar el nombre: ' + error.message);
    } else {
      alert(`Descripción actualizada a "${nuevoNombre}"`);
      await obtenerProductos();
    }

    setActualizandoNombreId(null);
  }

  async function eliminarProducto(producto: Producto) {
    const confirmar = confirm(
      `¿Estás seguro de que deseas eliminar "${producto.nombre}" del inventario?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEliminandoId(producto.id);

    const { error } = await supabase.from('productos').delete().eq('id', producto.id);

    if (error) {
      alert('Error al eliminar el producto: ' + error.message);
    } else {
      alert(`El producto "${producto.nombre}" ha sido eliminado del inventario.`);
      await obtenerProductos();
    }

    setEliminandoId(null);
  }

  async function anularVenta(venta: Venta) {
    const confirmar = confirm(
      `¿Estás seguro de anular la venta de "${venta.producto_nombre}"? Se devolverá el stock.`
    );
    if (!confirmar) return;

    const { data: prod } = await supabase
      .from('productos')
      .select('stock')
      .eq('id', venta.producto_id)
      .single();

    if (prod) {
      await supabase
        .from('productos')
        .update({ stock: prod.stock + venta.cantidad })
        .eq('id', venta.producto_id);
    }

    const { error: errDelete } = await supabase.from('ventas').delete().eq('id', venta.id);

    if (errDelete) {
      alert('Error al eliminar la venta: ' + errDelete.message);
    } else {
      alert('Venta anulada y stock devuelto exitosamente.');
      await cargarDatos();
    }
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  const ventasHoy = ventas.filter((v) => v.fecha && v.fecha.startsWith(hoyStr));

  const totalIngresosHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0);
  const totalIngresosAcumulado = ventas.reduce((acc, v) => acc + Number(v.total), 0);

  const desgloseMetodosHoy = ventasHoy.reduce(
    (acc, v) => {
      const m = v.metodo_pago || 'Efectivo';
      acc[m] = (acc[m] || 0) + Number(v.total);
      return acc;
    },
    {} as { [key: string]: number }
  );

  const productosBajosStock = productos.filter((p) => p.stock <= 5).length;
const ventasFiltradasPeriodo = ventas.filter((venta) => {
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

  const totalVentasPeriodo = ventasFiltradasPeriodo.reduce((acc, v) => acc + Number(v.total), 0);
  // =========================================================
  // RENDER CONDICIONAL DE LOGIN (OBLIGATORIO ARRIBA)
  // =========================================================
  if (!estaAutenticado) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900">Acceso al Sistema POS</h1>
            <p className="text-xs text-slate-500 mt-1">Ingresa tus credenciales para continuar</p>
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
                placeholder="Ej. admin"
                value={usuarioIngresado}
                onChange={(e) => setUsuarioIngresado(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900"
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
                className="w-full border border-slate-300 p-3 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900"
              />
            </div>

            {errorLogin && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600 text-center">
                ⚠️ {errorLogin}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-lg shadow-md transition text-sm uppercase tracking-wider"
            >
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================
  // RETURN PRINCIPAL DEL POS (CUANDO SÍ ESTÁ AUTENTICADO)
  // =========================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* ENCABEZADO PRINCIPAL */}
      <header className="bg-slate-900 text-white shadow-md border-b-4 border-amber-500">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🛠️</span>
            <div>
              <h1 className="text-2xl font-black tracking-wide uppercase text-amber-400">
                {NOMBRE_FERRETERIA}
              </h1>
              <p className="text-xs text-slate-400">Terminal de Caja & Control de Almacén</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-center">
              <span className="block text-xs text-slate-400">Ventas Hoy</span>
              <span className="text-lg font-bold text-emerald-400">
                S/ {totalIngresosHoy.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => {
                setPestanaActiva('inventario');
                setSoloStockBajo(true);
              }}
              className={`px-4 py-2 rounded-lg border text-center transition ${
                productosBajosStock > 0
                  ? 'bg-amber-950/40 border-amber-500 text-amber-300 hover:bg-amber-900/50'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <span className="block text-xs uppercase tracking-wider font-semibold">
                Stock Crítico
              </span>
              <span className="text-lg font-black">{productosBajosStock} ítems</span>
            </button>

            <button
              onClick={cerrarSesion}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-3 rounded-lg transition shadow"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* NAVEGACIÓN Y CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* BARRA DE PESTAÑAS */}
        <div className="flex flex-wrap gap-2 border-b border-slate-300 pb-2">
          <button
            onClick={() => setPestanaActiva('venta')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'venta'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            🛒 POS / Terminal de Ventas
          </button>

          <button
            onClick={() => setPestanaActiva('caja')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'caja'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            💵 Cierre de Caja
          </button>

          <button
            onClick={() => setPestanaActiva('inventario')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'inventario'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            📦 Inventario ({productos.length})
          </button>

          <button
            onClick={() => setPestanaActiva('reporte')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'reporte'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            📊 Historial de Ventas
          </button>

          <button
            onClick={() => setPestanaActiva('producto')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
              pestanaActiva === 'producto'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200 border'
            }`}
          >
            ➕ Nuevo Producto
          </button>
        </div>

        {/* 1. POS / TERMINAL DE VENTAS */}
        {pestanaActiva === 'venta' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border p-5 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b pb-3 flex justify-between items-center">
                <span>🔍 Buscar e Ingresar Producto</span>
                <span className="text-xs text-slate-400 font-normal">Busca por nombre o código ID</span>
              </h2>

              <div className="relative" ref={dropdownRef}>
                <input
                  ref={inputBusquedaRef}
                  type="text"
                  placeholder="Escribe el nombre o código del producto..."
                  value={busquedaProducto}
                  onChange={(e) => {
                    setBusquedaProducto(e.target.value);
                    setMostrarSugerencias(true);
                  }}
                  onFocus={() => setMostrarSugerencias(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && productosFiltradosBusqueda.length > 0) {
                      agregarAlCarrito(productosFiltradosBusqueda[0]);
                    }
                  }}
                  className="w-full border-2 border-slate-300 p-3 rounded-lg text-lg text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
                  autoFocus
                />

                {mostrarSugerencias && busquedaProducto.length > 0 && (
                  <ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {productosFiltradosBusqueda.length === 0 ? (
                      <li className="p-4 text-sm text-slate-500 text-center">
                        No se encontró ningún producto coincidente.
                      </li>
                    ) : (
                      productosFiltradosBusqueda.map((p) => (
                        <li
                          key={p.id}
                          onClick={() => agregarAlCarrito(p)}
                          className="p-3 hover:bg-amber-50 cursor-pointer flex justify-between items-center transition"
                        >
                          <div>
                            <span className="text-xs font-mono text-slate-400 mr-2">#{p.id}</span>
                            <span className="font-semibold text-slate-900">{p.nombre}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800 block">
                              S/ {(p.precio || p.precio_venta || 0).toFixed(2)}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-bold ${
                                p.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Stock: {p.stock}
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
                  Catálogo Rápido (Haz clic para agregar)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto p-1">
                  {productos.slice(0, 9).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      disabled={p.stock <= 0}
                      className="p-3 text-left border rounded-lg hover:border-amber-500 hover:bg-amber-50/50 transition bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-between"
                    >
                      <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                        {p.nombre}
                      </span>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-amber-700">
                          S/ {(p.precio || p.precio_venta || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500">Stk: {p.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-center border-b pb-3">
                  <h2 className="text-lg font-bold text-slate-900">🛒 Ticket de Venta Actual</h2>
                  {carrito.length > 0 && (
                    <button
                      onClick={() => setCarrito([])}
                      className="text-xs text-red-600 hover:underline font-semibold"
                    >
                      Vaciar Carrito
                    </button>
                  )}
                </div>

                <div className="mt-4 max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {carrito.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <span className="text-4xl block mb-2">🛍️</span>
                      <p className="text-sm">El carrito está vacío.</p>
                      <p className="text-xs text-slate-400">Busca e ingresa productos para cobrar.</p>
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
                          title="Eliminar"
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
                  <span className="text-sm font-bold">TOTAL A COBRAR:</span>
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
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
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
                        Vuelto a Entregar
                      </label>
                      <div className="p-2 bg-white border rounded text-sm font-black text-blue-600 h-9 flex items-center">
                        S/ {vueltoCalculado.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
{/* Selector de Comprobante y Datos del Cliente */}
                <div className="border-t pt-3 space-y-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-600">
                    Tipo de Comprobante
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoComprobante('TICKET')}
                      className={`py-1.5 text-xs font-bold rounded border transition ${
                        tipoComprobante === 'TICKET'
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      TICKET DE VENTA
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoComprobante('PROFORMA')}
                      className={`py-1.5 text-xs font-bold rounded border transition ${
                        tipoComprobante === 'PROFORMA'
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      PROFORMA
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      {tipoComprobante === 'PROFORMA' ? 'RUC del Cliente (11 dígitos)' : 'DNI / Doc Cliente (Opcional)'}
                    </label>
                    <input
                      type="text"
                      maxLength={tipoComprobante === 'PROFORMA' ? 11 : 15}
                      placeholder={tipoComprobante === 'PROFORMA' ? 'Ingrese RUC de 11 dígitos' : 'DNI o sin documento'}
                      value={documentoCliente}
                      onChange={(e) => setDocumentoCliente(e.target.value)}
                      className="w-full border border-slate-300 p-2 rounded text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      {tipoComprobante === 'PROFORMA' ? 'Razón Social / Nombre Empresa' : 'Nombre del Cliente (Opcional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={tipoComprobante === 'PROFORMA' ? 'Nombre de la empresa' : 'Cliente Varios'}
                      value={nombreCliente}
                      onChange={(e) => setNombreCliente(e.target.value)}
                      className="w-full border border-slate-300 p-2 rounded text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
                <button
                  onClick={finalizarVentaMultiProducto}                  
                  disabled={procesandoVenta || carrito.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-lg shadow-md transition disabled:opacity-50 text-base uppercase tracking-wide mt-2"
                >
                  {procesandoVenta ? 'Procesando Venta...' : '✓ COBRAR Y REGISTRAR VENTA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. CIERRE Y ARQUEO DE CAJA */}
        {pestanaActiva === 'caja' && (
          <div className="bg-white rounded-xl shadow-sm border max-w-4xl mx-auto overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-amber-400">💵 Resumen, Cierre y Reportes de Caja</h2>
                <p className="text-xs text-slate-300">Filtra y analiza el rendimiento de tus ventas</p>
              </div>
              <span className="bg-emerald-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase">
                Sistema Activo
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Controles de Filtro y Fecha */}
              <div className="bg-slate-50 p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 w-full sm:w-auto">
                  {(['diario', 'semanal', 'mensual'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroReporte(tipo)}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition ${
                        filtroReporte === tipo
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-white text-slate-700 border hover:bg-slate-100'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>

                <div className="w-full sm:w-auto flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Base:</span>
                  <input
                    type="date"
                    value={fechaSeleccionada}
                    onChange={(e) => setFechaSeleccionada(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
                  />
                </div>
              </div>

              {/* Tarjetas de Totales del Periodo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                    Total Ingresos ({filtroReporte})
                  </span>
                  <span className="text-2xl font-black text-amber-950 mt-1 block">
                    S/ {totalVentasPeriodo.toFixed(2)}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                    Transacciones en el Periodo
                  </span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">
                    {ventasFiltradasPeriodo.length} operaciones
                  </span>
                </div>
              </div>

              {/* Desglose de Métodos de Pago del Día (Se mantiene para arqueo rápido) */}
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">
                  Desglose de Efectivo y Pagos (Solo ventas de Hoy)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-xs font-bold text-emerald-800 block">💵 Efectivo (Hoy)</span>
                    <span className="text-lg font-black text-emerald-900">
                      S/ {(desgloseMetodosHoy['Efectivo'] || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="text-xs font-bold text-purple-800 block">📱 Yape (Hoy)</span>
                    <span className="text-lg font-black text-purple-900">
                      S/ {(desgloseMetodosHoy['Yape'] || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
                    <span className="text-xs font-bold text-sky-800 block">📱 Plin (Hoy)</span>
                    <span className="text-lg font-black text-sky-900">
                      S/ {(desgloseMetodosHoy['Plin'] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabla de Detalle del Reporte Filtrado */}
              <div className="border-t pt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">
                  Detalle de Ventas del Reporte ({filtroReporte})
                </h3>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b text-[11px] uppercase tracking-wider text-slate-600">
                        <th className="p-3">Fecha y Hora</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3">Cant.</th>
                        <th className="p-3">Método</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {ventasFiltradasPeriodo.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                            No se registraron ventas en este periodo o fecha seleccionada.
                          </td>
                        </tr>
                      ) : (
                        ventasFiltradasPeriodo.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="p-3 text-xs font-mono text-slate-500">
                              {new Date(v.fecha).toLocaleString('es-PE')}
                            </td>
                            <td className="p-3 font-medium text-slate-800">{v.producto_nombre}</td>
                            <td className="p-3 font-bold">{v.cantidad}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 text-xs bg-slate-100 border rounded font-semibold text-slate-700">
                                {v.metodo_pago || 'Efectivo'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              S/ {Number(v.total).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cuadre de Caja Físico */}
              <div className="border-t pt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Cuadre de Efectivo Físico en Cajón (Cierre Diario)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-xl border">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Efectivo contado en cajón (S/)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={efectivoEnCajon}
                      onChange={(e) => setEfectivoEnCajon(e.target.value)}
                      className="w-full border border-slate-300 p-2.5 rounded-lg font-bold text-slate-900 text-base"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-bold text-slate-600 mb-1">Resultado de Cuadre:</span>
                    {efectivoEnCajon !== '' ? (
                      (() => {
                        const esperado = desgloseMetodosHoy['Efectivo'] || 0;
                        const contado = parseFloat(efectivoEnCajon) || 0;
                        const diff = contado - esperado;

                        if (diff === 0) {
                          return (
                            <span className="p-2.5 bg-emerald-100 text-emerald-800 font-bold rounded-lg block text-center border border-emerald-300 text-xs">
                              ✓ Caja Cuadrada Perfectamente
                            </span>
                          );
                        } else if (diff > 0) {
                          return (
                            <span className="p-2.5 bg-blue-100 text-blue-800 font-bold rounded-lg block text-center border border-blue-300 text-xs">
                              ℹ️ Sobrante de S/ {diff.toFixed(2)}
                            </span>
                          );
                        } else {
                          return (
                            <span className="p-2.5 bg-red-100 text-red-800 font-bold rounded-lg block text-center border border-red-300 text-xs">
                              ⚠️ Faltante de S/ {Math.abs(diff).toFixed(2)}
                            </span>
                          );
                        }
                      })()
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Ingresa el dinero físico para comparar con el sistema.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. INVENTARIO DISPONIBLE */}
        {pestanaActiva === 'inventario' && (
          <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-5 bg-slate-50 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Inventario en Almacén</h2>
                <span className="text-xs text-slate-500">
                  Mostrando {productosInventarioFiltrados.length} de {productos.length} artículos
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setSoloStockBajo(!soloStockBajo)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition w-full sm:w-auto ${
                    soloStockBajo
                      ? 'bg-amber-500 text-slate-950 border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {soloStockBajo ? '✓ Mostrando solo Stock Bajo' : '⚠️ Filtrar Stock Bajo'}
                </button>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o ID..."
                    value={filtroInventario}
                    onChange={(e) => setFiltroInventario(e.target.value)}
                    className="w-full border border-slate-300 pl-3 pr-8 py-2 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {filtroInventario && (
                    <button
                      onClick={() => setFiltroInventario('')}
                      className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-xs uppercase tracking-wider text-slate-600">
                    <th className="p-4">Cód.</th>
                    <th className="p-4">Descripción del Producto</th>
                    <th className="p-4">Precio Unit.</th>
                    <th className="p-4 text-center">Modificar Precio</th>
                    <th className="p-4">Stock Actual</th>
                    <th className="p-4 text-center">Reponer Stock</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {productosInventarioFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No se encontraron productos coincidentes.
                      </td>
                    </tr>
                  ) : (
                    productosInventarioFiltrados.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-mono text-sm text-slate-500">#{p.id}</td>
                        <td className="p-4 min-w-[240px]">
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={nombresNuevos[p.id] ?? p.nombre}
                              onChange={(e) =>
                                setNombresNuevos({
                                  ...nombresNuevos,
                                  [p.id]: e.target.value,
                                })
                              }
                              className="w-full border border-slate-300 p-1.5 rounded text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              onClick={() => cambiarNombre(p)}
                              disabled={actualizandoNombreId === p.id}
                              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-2.5 py-2 rounded transition"
                            >
                              💾
                            </button>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-slate-800 whitespace-nowrap">
                          S/ {(p.precio || p.precio_venta || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <input
                              type="number"
                              step="0.10"
                              placeholder="S/"
                              value={preciosNuevos[p.id] || ''}
                              onChange={(e) =>
                                setPreciosNuevos({
                                  ...preciosNuevos,
                                  [p.id]: e.target.value,
                                })
                              }
                              className="w-20 border border-slate-300 p-1.5 rounded text-sm text-slate-800"
                            />
                            <button
                              onClick={() => cambiarPrecio(p)}
                              disabled={actualizandoPrecioId === p.id}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold px-3 py-2 rounded transition"
                            >
                              Guardar
                            </button>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              p.stock <= 5
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {p.stock} unids.
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Cant."
                              value={cantidadesAgregar[p.id] || ''}
                              onChange={(e) =>
                                setCantidadesAgregar({
                                  ...cantidadesAgregar,
                                  [p.id]: e.target.value,
                                })
                              }
                              className="w-20 border border-slate-300 p-1.5 rounded text-sm text-slate-800"
                            />
                            <button
                              onClick={() => sumarStock(p)}
                              disabled={actualizandoStockId === p.id}
                              className="bg-slate-900 text-amber-400 hover:bg-slate-800 text-xs font-bold px-3 py-2 rounded transition"
                            >
                              + Sumar
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => eliminarProducto(p)}
                            disabled={eliminandoId === p.id}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-2 rounded transition"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. HISTORIAL DE VENTAS */}
        {pestanaActiva === 'reporte' && (
          <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Historial General de Ventas</h2>
              <div className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-sm px-4 py-1.5 rounded-full">
                Total acumulado: S/ {totalIngresosAcumulado.toFixed(2)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-xs uppercase tracking-wider text-slate-600">
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Producto Vendido</th>
                    <th className="p-4">Cantidad</th>
                    <th className="p-4">Método Pago</th>
                    <th className="p-4">Total Cobrado</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {ventas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No hay ventas registradas.
                      </td>
                    </tr>
                  ) : (
                    ventas.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 text-xs font-mono text-slate-500">
                          {new Date(v.fecha).toLocaleString('es-PE')}
                        </td>
                        <td className="p-4 font-medium text-slate-900">{v.producto_nombre}</td>
                        <td className="p-4 font-semibold">{v.cantidad}</td>
                        <td className="p-4">
                          <span className="text-xs bg-slate-100 border px-2 py-1 rounded font-bold text-slate-700">
                            {v.metodo_pago || 'Efectivo'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-emerald-600">
                          S/ {Number(v.total).toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => anularVenta(v)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-1.5 rounded transition"
                          >
                            Anular
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. REGISTRAR NUEVO PRODUCTO */}
        {pestanaActiva === 'producto' && (
          <div className="bg-white rounded-xl shadow-sm border max-w-lg mx-auto overflow-hidden">
            <div className="p-5 bg-slate-50 border-b">
              <h2 className="text-xl font-bold text-slate-800">Agregar Nuevo Producto</h2>
            </div>
            <form onSubmit={agregarProducto} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nombre / Descripción del artículo
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Ej. Martillo de Uña 16oz Stanley"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Precio de Venta (S/)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Stock Inicial
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="0"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={guardando}
                className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold py-3 rounded-lg shadow transition disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '+ Guardar en Inventario'}
              </button>
            </form>
          </div>
        )}
      </main>
      {/* MODAL DE COMPROBANTE EXITOSO PARA IMPRIMIR */}
      {ventaExitosaModal && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 print:shadow-none print:w-full print:max-w-none print:p-0">
            
            {/* Contenido del Ticket Impreso */}
            <div className="text-slate-900 space-y-3 font-mono text-xs border-b pb-4 print:border-none">
              <div className="text-center space-y-1">
                <h2 className="font-bold text-sm uppercase">{DATOS_EMPRESA.razonSocial}</h2>
                <p className="text-[10px]">RUC: {DATOS_EMPRESA.ruc}</p>
                <p className="text-[10px]">{DATOS_EMPRESA.direccion}</p>
                <p className="text-[10px]">Tel: {DATOS_EMPRESA.telefono}</p>
                <div className="border-t border-dashed my-2"></div>
                <p className="font-bold uppercase text-sm bg-slate-100 py-1">
                  {ventaExitosaModal.tipo} ELECTRÓNICA
                </p>
                <p className="font-bold">N°: B001-{ventaExitosaModal.id}</p>
                <p className="text-[10px]">Fecha: {new Date(ventaExitosaModal.fecha).toLocaleString('es-PE')}</p>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1 text-[11px]">
                <p><strong>Cliente:</strong> {ventaExitosaModal.clienteNombre}</p>
                <p><strong>Doc:</strong> {ventaExitosaModal.clienteDocumento}</p>
                <p><strong>Pago:</strong> {ventaExitosaModal.metodoPago}</p>
              </div>

              <div className="border-t border-dashed pt-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-[10px]">
                      <th className="pb-1">Cant. / Descrip</th>
                      <th className="pb-1 text-right">P.Unit</th>
                      <th className="pb-1 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed text-[11px]">
                    {ventaExitosaModal.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-1">
                          {item.cantidad}x {item.producto.nombre}
                        </td>
                        <td className="py-1 text-right">
                          {(item.producto.precio || item.producto.precio_venta || 0).toFixed(2)}
                        </td>
                        <td className="py-1 text-right">
                          S/ {item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1 text-right">
                <p className="text-sm font-bold">TOTAL: S/ {ventaExitosaModal.total.toFixed(2)}</p>
                {ventaExitosaModal.metodoPago === 'Efectivo' && (
                  <>
                    <p className="text-[10px]">Vuelto: S/ {ventaExitosaModal.vuelto.toFixed(2)}</p>
                  </>
                )}
              </div>

              <div className="text-center pt-3 text-[10px] text-slate-500">
                <p>¡Gracias por su compra en GYT!</p>
                <p>Representación impresa de comprobante interno</p>
              </div>
            </div>

            {/* Botones de Acción (No salen al imprimir en papel) */}
            <div className="flex gap-3 print:hidden">
              <button
                onClick={imprimirComprobante}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-lg text-xs uppercase tracking-wider shadow"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                onClick={() => setVentaExitosaModal(null)}
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