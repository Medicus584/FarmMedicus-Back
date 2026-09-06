// src/services/productsService.js
const { query, pool } = require("../../db");

const productsService = {
  // Obtener opciones de selección
  getUbicaciones: async () => {
    const result = await query(
      "SELECT * FROM ubicaciones WHERE estado = 0 ORDER BY nombre",
    );
    return result.rows;
  },

  getCategorias: async () => {
    const result = await query(
      "SELECT * FROM categorias WHERE estado = 0 ORDER BY nombre",
    );
    return result.rows;
  },

  getLaboratorios: async () => {
    const result = await query(
      "SELECT * FROM laboratorios WHERE estado = 0 ORDER BY nombre_laboratorio",
    );
    return result.rows;
  },

  getFormasFarmaceuticas: async () => {
    const result = await query(
      "SELECT * FROM forma_farmaceutica WHERE estado = 0 ORDER BY nombre_forma",
    );
    return result.rows;
  },

  getTodosProductosSelect: async (searchTerm = '') => {
    let queryStr = `
      SELECT idproducto, nombre, descripcion 
      FROM productos 
      WHERE estado = 0 
    `;
    const params = [];
    
    if (searchTerm && searchTerm.trim().length >= 2) {
      queryStr += ` AND (nombre ILIKE $1 OR descripcion ILIKE $1)`;
      params.push(`%${searchTerm.trim()}%`);
    }
    
    const result = await query(queryStr, params);
    
    return result.rows.map(row => ({
      idproducto: row.idproducto,
      nombre: row.nombre || 'Sin nombre',
      descripcion: row.descripcion || ''
    }));
  },

  getProductoByCodigoP: async (codigoP) => {
    if (!codigoP || codigoP.trim() === '') {
      return null;
    }

    const result = await query(
      `SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        l.nombre_laboratorio as laboratorio_nombre,
        ff.nombre_forma as forma_farmaceutica_nombre,
        ARRAY_AGG(DISTINCT c.nombre) FILTER (WHERE c.nombre IS NOT NULL) as categorias,
        COALESCE(lt.stock_total, 0) as stock_total,
        COALESCE(lt.lotes, '[]'::jsonb) as lotes
      FROM productos p
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN laboratorios l ON p.idlaboratorio = l.idlaboratorio
      LEFT JOIN forma_farmaceutica ff ON p.idforma_farmaceutica = ff.idforma_farmaceutica
      LEFT JOIN LATERAL (
        SELECT 
          SUM(lo.stock) as stock_total,
          jsonb_agg(
            jsonb_build_object(
              'idlote', lo.idlote,
              'stock', lo.stock,
              'fecha_vencimiento', lo.fecha_vencimiento
            ) ORDER BY lo.fecha_vencimiento NULLS LAST
          ) as lotes
        FROM lotes lo
        WHERE lo.idproducto = p.idproducto AND lo.estado = 0
          AND (
            lo.fecha_vencimiento >= CURRENT_DATE
            OR lo.stock > 0
            OR lo.fecha_vencimiento IS NULL
          )
      ) lt ON true
      WHERE p.estado = 0 AND p.codigop = $1
      GROUP BY p.idproducto, u.nombre, u.idubicacion, l.nombre_laboratorio, ff.nombre_forma, lt.stock_total, lt.lotes
      `,
      [codigoP.trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const producto = result.rows[0];

    let imagenBase64 = "";
    if (producto.imagen) {
      try {
        const base64 = producto.imagen.toString("base64");
        imagenBase64 = `data:image/jpeg;base64,${base64}`;
      } catch (error) {
        console.error(`Error al convertir imagen del producto ${producto.idproducto}:`, error);
      }
    }

    const similaresResult = await query(
      `
      WITH RECURSIVE similar_products AS (
        SELECT DISTINCT 
          CASE 
            WHEN idproducto = $1::integer THEN idproducto_similar
            WHEN idproducto_similar = $1::integer THEN idproducto
          END as idproducto_relacionado
        FROM productos_similares
        WHERE idproducto = $1::integer OR idproducto_similar = $1::integer
        
        UNION
        
        SELECT DISTINCT
          CASE 
            WHEN ps.idproducto = sp.idproducto_relacionado THEN ps.idproducto_similar
            WHEN ps.idproducto_similar = sp.idproducto_relacionado THEN ps.idproducto
          END
        FROM productos_similares ps
        INNER JOIN similar_products sp ON 
          ps.idproducto = sp.idproducto_relacionado OR 
          ps.idproducto_similar = sp.idproducto_relacionado
      )
      SELECT DISTINCT p.idproducto, p.nombre
      FROM similar_products sp
      JOIN productos p ON sp.idproducto_relacionado = p.idproducto
      WHERE p.estado = 0 AND p.idproducto != $1::integer
      ORDER BY p.nombre
      `,
      [producto.idproducto]
    );

    return {
      idproducto: producto.idproducto,
      codigoP: producto.codigop,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      idubicacion: producto.idubicacion,
      ubicacion_nombre: producto.ubicacion_nombre || "Sin ubicación",
      idlaboratorio: producto.idlaboratorio || 0,
      laboratorio_nombre: producto.laboratorio_nombre || "Sin laboratorio",
      idforma_farmaceutica: producto.idforma_farmaceutica || 0,
      forma_farmaceutica_nombre: producto.forma_farmaceutica_nombre || "Sin forma farmacéutica",
      categorias: producto.categorias || [],
      estado: producto.estado ?? 1,
      imagen: imagenBase64,
      precio_venta: producto.precio_venta ?? "0",
      precio_compra: producto.precio_compra ?? "0",
      stock_total: producto.stock_total || 0,
      stock_minimo: producto.stock_minimo || 0,
      codigo_barras: producto.codigo_barras || null,
      lotes: (producto.lotes || []).map((lote) => ({
        idlote: lote.idlote,
        stock: lote.stock,
        fechaVencimiento: lote.fecha_vencimiento || '',
      })),
      productos_similares: similaresResult.rows,
    };
  },

  getTodosProductos: async (page, limit) => {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `
      SELECT COUNT(DISTINCT p.idproducto) as total
      FROM productos p
      WHERE p.estado = 0 
    `,
      [],
    );

    const total = parseInt(countResult.rows[0].total, 10);

    if (total === 0) {
      return {
        productos: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
      };
    }

    const result = await query(
      `
      SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        u.idubicacion,
        l.nombre_laboratorio as laboratorio_nombre,
        ff.nombre_forma as forma_farmaceutica_nombre,
        ARRAY_AGG(DISTINCT c.nombre) FILTER (WHERE c.nombre IS NOT NULL) as categorias,
        ARRAY_AGG(DISTINCT tp.nombre) FILTER (WHERE tp.nombre IS NOT NULL) as tipos,
        COALESCE(lt.stock_total, 0) as stock_total,
        COALESCE(lt.lotes, '[]'::jsonb) as lotes
      FROM productos p
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN producto_tipos pt ON p.idproducto = pt.idproducto
      LEFT JOIN tipos tp ON pt.idtipo = tp.idtipo
      LEFT JOIN laboratorios l ON p.idlaboratorio = l.idlaboratorio
      LEFT JOIN forma_farmaceutica ff ON p.idforma_farmaceutica = ff.idforma_farmaceutica
      LEFT JOIN LATERAL (
        SELECT 
          SUM(lo.stock) as stock_total,
          jsonb_agg(
            jsonb_build_object(
              'idlote', lo.idlote,
              'stock', lo.stock,
              'fecha_vencimiento', lo.fecha_vencimiento
            ) ORDER BY lo.fecha_vencimiento NULLS LAST
          ) as lotes
        FROM lotes lo
        WHERE lo.idproducto = p.idproducto AND lo.estado = 0
          AND (
            lo.fecha_vencimiento >= CURRENT_DATE
            OR lo.stock > 0
            OR lo.fecha_vencimiento IS NULL
          )
      ) lt ON true
      WHERE p.estado = 0 
      GROUP BY p.idproducto, u.nombre, u.idubicacion, l.nombre_laboratorio, ff.nombre_forma, lt.stock_total, lt.lotes
      ORDER BY p.nombre
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    );

    const productos = await Promise.all(
      result.rows.map(async (producto) => {
        let imagenBase64 = "";
        if (producto.imagen) {
          try {
            const base64 = producto.imagen.toString("base64");
            imagenBase64 = `data:image/jpeg;base64,${base64}`;
          } catch (error) {
            console.error(
              `Error al convertir imagen del producto ${producto.idproducto}:`,
              error,
            );
          }
        }

        const similaresResult = await query(
          `
          WITH RECURSIVE similar_products AS (
            SELECT DISTINCT 
              CASE 
                WHEN idproducto = $1::integer THEN idproducto_similar
                WHEN idproducto_similar = $1::integer THEN idproducto
              END as idproducto_relacionado
            FROM productos_similares
            WHERE idproducto = $1::integer OR idproducto_similar = $1::integer
            
            UNION
            
            SELECT DISTINCT
              CASE 
                WHEN ps.idproducto = sp.idproducto_relacionado THEN ps.idproducto_similar
                WHEN ps.idproducto_similar = sp.idproducto_relacionado THEN ps.idproducto
              END
            FROM productos_similares ps
            INNER JOIN similar_products sp ON 
              ps.idproducto = sp.idproducto_relacionado OR 
              ps.idproducto_similar = sp.idproducto_relacionado
          )
          SELECT DISTINCT p.idproducto, p.nombre
          FROM similar_products sp
          JOIN productos p ON sp.idproducto_relacionado = p.idproducto
          WHERE p.estado = 0 AND p.idproducto != $1::integer
          ORDER BY p.nombre
        `,
          [producto.idproducto],
        );

        return {
          idproducto: producto.idproducto,
          codigoP: producto.codigop,
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          idubicacion: producto.idubicacion,
          ubicacion_nombre: producto.ubicacion_nombre || "Sin ubicación",
          idlaboratorio: producto.idlaboratorio || 0,
          laboratorio_nombre: producto.laboratorio_nombre || "Sin laboratorio",
          idforma_farmaceutica: producto.idforma_farmaceutica || 0,
          forma_farmaceutica_nombre: producto.forma_farmaceutica_nombre || "Sin forma farmacéutica",
          categorias: producto.categorias || [],
          estado: producto.estado ?? 1,
          imagen: imagenBase64,
          precio_venta: producto.precio_venta ?? "0",
          precio_compra: producto.precio_compra ?? "0",
          stock_total: producto.stock_total || 0,
          stock_minimo: producto.stock_minimo || 0,
          codigo_barras: producto.codigo_barras || null,
          lotes: (producto.lotes || []).map((lote) => ({
            idlote: lote.idlote,
            stock: lote.stock,
            fechaVencimiento: lote.fecha_vencimiento || '',
          })),
          productos_similares: similaresResult.rows,
        };
      }),
    );

    return {
      productos,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  },

  buscarProductos: async (termino, categoria, laboratorio, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;

    let whereClause = 'p.estado = 0';
    const params = [];
    let paramIndex = 1;

    if (termino && termino.trim().length >= 2) {
      const searchTerm = `%${termino.trim()}%`;
      whereClause += ` AND (
        p.codigop ILIKE $${paramIndex} OR 
        p.nombre ILIKE $${paramIndex} OR 
        p.descripcion ILIKE $${paramIndex} OR 
        p.codigo_barras ILIKE $${paramIndex}
      )`;
      params.push(searchTerm);
      paramIndex++;
    }

    if (categoria) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM producto_categorias pc 
        JOIN categorias c ON pc.idcategoria = c.idcategoria 
        WHERE pc.idproducto = p.idproducto AND c.nombre = $${paramIndex}
      )`;
      params.push(categoria);
      paramIndex++;
    }

    if (laboratorio) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM laboratorios l 
        WHERE l.idlaboratorio = p.idlaboratorio AND l.nombre_laboratorio = $${paramIndex}
      )`;
      params.push(laboratorio);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(DISTINCT p.idproducto) as total
      FROM productos p
      WHERE ${whereClause}
    `;

    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    if (total === 0) {
      return {
        productos: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
      };
    }

    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const querySQL = `
      SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        u.idubicacion,
        l.nombre_laboratorio as laboratorio_nombre,
        ff.nombre_forma as forma_farmaceutica_nombre,
        ARRAY_AGG(DISTINCT c.nombre) FILTER (WHERE c.nombre IS NOT NULL) as categorias,
        COALESCE(lt.stock_total, 0) as stock_total,
        COALESCE(lt.lotes, '[]'::jsonb) as lotes
      FROM productos p
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN laboratorios l ON p.idlaboratorio = l.idlaboratorio
      LEFT JOIN forma_farmaceutica ff ON p.idforma_farmaceutica = ff.idforma_farmaceutica
      LEFT JOIN LATERAL (
        SELECT 
          SUM(lo.stock) as stock_total,
          jsonb_agg(
            jsonb_build_object(
              'idlote', lo.idlote,
              'stock', lo.stock,
              'fecha_vencimiento', lo.fecha_vencimiento
            ) ORDER BY lo.fecha_vencimiento NULLS LAST
          ) as lotes
        FROM lotes lo
        WHERE lo.idproducto = p.idproducto AND lo.estado = 0
          AND (
            lo.fecha_vencimiento >= CURRENT_DATE
            OR lo.stock > 0
            OR lo.fecha_vencimiento IS NULL
          )
      ) lt ON true
      WHERE ${whereClause}
      GROUP BY p.idproducto, u.nombre, u.idubicacion, l.nombre_laboratorio, ff.nombre_forma, lt.stock_total, lt.lotes
      ORDER BY p.nombre
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(querySQL, params);

    const productos = await Promise.all(
      result.rows.map(async (producto) => {
        let imagenBase64 = "";
        if (producto.imagen) {
          try {
            const base64 = producto.imagen.toString("base64");
            imagenBase64 = `data:image/jpeg;base64,${base64}`;
          } catch (error) {
            console.error(
              `Error al convertir imagen del producto ${producto.idproducto}:`,
              error,
            );
          }
        }

        const similaresResult = await query(
          `
          WITH RECURSIVE similar_products AS (
            SELECT DISTINCT 
              CASE 
                WHEN idproducto = $1::integer THEN idproducto_similar
                WHEN idproducto_similar = $1::integer THEN idproducto
              END as idproducto_relacionado
            FROM productos_similares
            WHERE idproducto = $1::integer OR idproducto_similar = $1::integer
            
            UNION
            
            SELECT DISTINCT
              CASE 
                WHEN ps.idproducto = sp.idproducto_relacionado THEN ps.idproducto_similar
                WHEN ps.idproducto_similar = sp.idproducto_relacionado THEN ps.idproducto
              END
            FROM productos_similares ps
            INNER JOIN similar_products sp ON 
              ps.idproducto = sp.idproducto_relacionado OR 
              ps.idproducto_similar = sp.idproducto_relacionado
          )
          SELECT DISTINCT p.idproducto, p.nombre
          FROM similar_products sp
          JOIN productos p ON sp.idproducto_relacionado = p.idproducto
          WHERE p.estado = 0 AND p.idproducto != $1::integer
          ORDER BY p.nombre
        `,
          [producto.idproducto],
        );

        return {
          idproducto: producto.idproducto,
          codigoP: producto.codigop,
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          idubicacion: producto.idubicacion,
          ubicacion_nombre: producto.ubicacion_nombre || "Sin ubicación",
          idlaboratorio: producto.idlaboratorio || 0,
          laboratorio_nombre: producto.laboratorio_nombre || "Sin laboratorio",
          idforma_farmaceutica: producto.idforma_farmaceutica || 0,
          forma_farmaceutica_nombre: producto.forma_farmaceutica_nombre || "Sin forma farmacéutica",
          categorias: producto.categorias || [],
          estado: producto.estado ?? 1,
          imagen: imagenBase64,
          precio_venta: producto.precio_venta ?? "0",
          precio_compra: producto.precio_compra ?? "0",
          stock_total: producto.stock_total || 0,
          stock_minimo: producto.stock_minimo || 0,
          codigo_barras: producto.codigo_barras || null,
          lotes: (producto.lotes || []).map((lote) => ({
            idlote: lote.idlote,
            stock: lote.stock,
            fechaVencimiento: lote.fecha_vencimiento || '',
          })),
          productos_similares: similaresResult.rows,
        };
      }),
    );

    return {
      productos,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  },

  getProductoById: async (id) => {
    const result = await query(
      `
      SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        u.idubicacion,
        l.nombre_laboratorio as laboratorio_nombre,
        ff.nombre_forma as forma_farmaceutica_nombre,
        ARRAY_AGG(DISTINCT c.nombre) as categorias,
        ARRAY_AGG(DISTINCT tp.nombre) as tipos,
        COALESCE(lt.stock_total, 0) as stock_total,
        COALESCE(lt.lotes, '[]'::jsonb) as lotes
      FROM productos p
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN producto_tipos pt ON p.idproducto = pt.idproducto
      LEFT JOIN tipos tp ON pt.idtipo = tp.idtipo
      LEFT JOIN laboratorios l ON p.idlaboratorio = l.idlaboratorio
      LEFT JOIN forma_farmaceutica ff ON p.idforma_farmaceutica = ff.idforma_farmaceutica
      LEFT JOIN LATERAL (
        SELECT 
          SUM(lo.stock) as stock_total,
          jsonb_agg(
            jsonb_build_object(
              'idlote', lo.idlote,
              'stock', lo.stock,
              'fecha_vencimiento', lo.fecha_vencimiento
            ) ORDER BY lo.fecha_vencimiento NULLS LAST
          ) as lotes
        FROM lotes lo
        WHERE lo.idproducto = p.idproducto AND lo.estado = 0
          AND (
            lo.fecha_vencimiento >= CURRENT_DATE
            OR lo.stock > 0
            OR lo.fecha_vencimiento IS NULL
          )
      ) lt ON true
      WHERE p.idproducto = $1 AND p.estado = 0
      GROUP BY p.idproducto, u.nombre, u.idubicacion, l.nombre_laboratorio, ff.nombre_forma, lt.stock_total, lt.lotes
    `,
      [id],
    );

    if (result.rows.length === 0) {
      throw new Error("Producto no encontrado");
    }

    const producto = result.rows[0];

    let imagenBase64 = "";
    if (producto.imagen) {
      try {
        const base64 = producto.imagen.toString("base64");
        imagenBase64 = `data:image/jpeg;base64,${base64}`;
      } catch (error) {
        console.error(
          `Error al convertir imagen del producto ${producto.idproducto}:`,
          error,
        );
        imagenBase64 = "";
      }
    }

    const similaresResult = await query(
      `
      WITH RECURSIVE similar_products AS (
        SELECT DISTINCT 
          CASE 
            WHEN idproducto = $1::integer THEN idproducto_similar
            WHEN idproducto_similar = $1::integer THEN idproducto
          END as idproducto_relacionado
        FROM productos_similares
        WHERE idproducto = $1::integer OR idproducto_similar = $1::integer
        
        UNION
        
        SELECT DISTINCT
          CASE 
            WHEN ps.idproducto = sp.idproducto_relacionado THEN ps.idproducto_similar
            WHEN ps.idproducto_similar = sp.idproducto_relacionado THEN ps.idproducto
          END
        FROM productos_similares ps
        INNER JOIN similar_products sp ON 
          ps.idproducto = sp.idproducto_relacionado OR 
          ps.idproducto_similar = sp.idproducto_relacionado
      )
      SELECT DISTINCT p.idproducto, p.nombre
      FROM similar_products sp
      JOIN productos p ON sp.idproducto_relacionado = p.idproducto
      WHERE p.estado = 0 AND p.idproducto != $1::integer
      ORDER BY p.nombre
    `,
      [id],
    );

    const productoProcesado = {
      idproducto: producto.idproducto,
      codigoP: producto.codigop,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      idubicacion: producto.idubicacion,
      ubicacion_nombre: producto.ubicacion_nombre || "Sin ubicación",
      ubicacion: producto.ubicacion_nombre || "Sin ubicación",
      idlaboratorio: producto.idlaboratorio || 0,
      laboratorio_nombre: producto.laboratorio_nombre || "Sin laboratorio",
      laboratorio: producto.laboratorio_nombre || "Sin laboratorio",
      idforma_farmaceutica: producto.idforma_farmaceutica || 0,
      forma_farmaceutica_nombre: producto.forma_farmaceutica_nombre || "Sin forma farmacéutica",
      forma_farmaceutica: producto.forma_farmaceutica_nombre || "Sin forma farmacéutica",
      categorias: producto.categorias?.filter((c) => c !== null) || [],
      estado: producto.estado,
      imagen: imagenBase64,
      precio_venta: producto.precio_venta || "0",
      precio_compra: producto.precio_compra || "0",
      stock_total: producto.stock_total || 0,
      stock_minimo: producto.stock_minimo || 0,
      codigo_barras: producto.codigo_barras || null,
      lotes: (producto.lotes || []).map((lote) => ({
        idlote: lote.idlote,
        stock: lote.stock,
        fechaVencimiento: lote.fecha_vencimiento || '',
      })),
      productos_similares: similaresResult.rows,
    };

    return productoProcesado;
  },

  crearRelacionesTransitivas: async (client, productoIds) => {
    if (!productoIds || productoIds.length < 2) return;

    const idsUnicos = [...new Set(productoIds.map((id) => parseInt(id)))];

    for (let i = 0; i < idsUnicos.length; i++) {
      for (let j = i + 1; j < idsUnicos.length; j++) {
        const id1 = idsUnicos[i];
        const id2 = idsUnicos[j];

        if (id1 !== id2) {
          const existe = await client.query(
            "SELECT 1 FROM productos_similares WHERE (idproducto = $1 AND idproducto_similar = $2) OR (idproducto = $2 AND idproducto_similar = $1)",
            [id1, id2],
          );

          if (existe.rows.length === 0) {
            await client.query(
              "INSERT INTO productos_similares (idproducto, idproducto_similar) VALUES ($1, $2), ($2, $1)",
              [id1, id2],
            );
          }
        }
      }
    }
  },

  obtenerGrupoCompleto: async (client, productoId) => {
    const id = parseInt(productoId);

    const result = await client.query(
      `
      SELECT DISTINCT idproducto, idproducto_similar
      FROM productos_similares
      WHERE idproducto = $1 OR idproducto_similar = $1
      `,
      [id],
    );

    const idsRelacionados = new Set();
    idsRelacionados.add(id);

    for (const row of result.rows) {
      idsRelacionados.add(row.idproducto);
      idsRelacionados.add(row.idproducto_similar);
    }

    let hayCambios = true;
    while (hayCambios) {
      hayCambios = false;
      const idsActuales = Array.from(idsRelacionados);

      for (const idActual of idsActuales) {
        const nuevasRelaciones = await client.query(
          `
          SELECT DISTINCT idproducto, idproducto_similar
          FROM productos_similares
          WHERE idproducto = $1 OR idproducto_similar = $1
          `,
          [idActual],
        );

        for (const row of nuevasRelaciones.rows) {
          if (!idsRelacionados.has(row.idproducto)) {
            idsRelacionados.add(row.idproducto);
            hayCambios = true;
          }
          if (!idsRelacionados.has(row.idproducto_similar)) {
            idsRelacionados.add(row.idproducto_similar);
            hayCambios = true;
          }
        }
      }
    }

    return Array.from(idsRelacionados).filter((idItem) => idItem !== id);
  },

  createProducto: async (productoData, imagenFile) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      if (productoData.codigoP) {
        const existingProduct = await client.query(
          "SELECT idproducto FROM productos WHERE codigop = $1 AND estado = 0",
          [productoData.codigoP.trim()]
        );
        
        if (existingProduct.rows.length > 0) {
          throw new Error(`Ya existe un producto con el código "${productoData.codigoP}"`);
        }
      }

      let imagenBuffer = null;
      if (imagenFile) {
        if (imagenFile.buffer) {
          imagenBuffer = imagenFile.buffer;
        } else if (imagenFile.data) {
          imagenBuffer = Buffer.from(imagenFile.data);
        } else {
          imagenBuffer = Buffer.from(imagenFile);
        }
      }

      const productoResult = await client.query(
        `INSERT INTO productos (
          codigop, nombre, descripcion, idubicacion, imagen, 
          precio_compra, precio_venta, idlaboratorio, idforma_farmaceutica, 
          stock_minimo, codigo_barras, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0) RETURNING *`,
        [
          productoData.codigoP || null,
          productoData.nombre,
          productoData.descripcion,
          productoData.idubicacion,
          imagenBuffer,
          productoData.precio_compra,
          productoData.precio_venta,
          productoData.idlaboratorio,
          productoData.idforma_farmaceutica,
          productoData.stock_minimo || 0,
          productoData.codigo_barras || null,
        ],
      );

      const producto = productoResult.rows[0];

      if (productoData.categorias && productoData.categorias.length > 0) {
        for (const idcategoria of productoData.categorias) {
          await client.query(
            "INSERT INTO producto_categorias (idproducto, idcategoria) VALUES ($1, $2)",
            [producto.idproducto, idcategoria],
          );
        }
      }

      if (productoData.lotes && productoData.lotes.length > 0) {
        const lotesInvalidos = productoData.lotes.some(
          (lote) =>
            lote.fecha_vencimiento &&
            new Date(lote.fecha_vencimiento).toISOString().split("T")[0] < new Date().toISOString().split("T")[0]
        );

        if (lotesInvalidos) {
          throw new Error(
            "Uno o más lotes tienen una fecha de vencimiento anterior a la fecha actual"
          );
        }

        const valores = productoData.lotes
          .map(
            (_, index) =>
              `($1, $${index * 2 + 2}, $${index * 2 + 3})`
          )
          .join(", ");

        const params = [
          producto.idproducto,
          ...productoData.lotes.flatMap((lote) => [
            lote.stock,
            lote.fecha_vencimiento || null,
          ]),
        ];

        await client.query(
          `
            INSERT INTO lotes (
              idproducto,
              stock,
              fecha_vencimiento
            )
            VALUES ${valores}
          `,
          params
        );
      }

      if (
        productoData.productos_similares &&
        productoData.productos_similares.length > 0
      ) {
        const todosIds = [
          producto.idproducto,
          ...productoData.productos_similares,
        ];
        await productsService.crearRelacionesTransitivas(client, todosIds);
      }

      await client.query("COMMIT");

      return await productsService.getProductoById(producto.idproducto);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  updateProducto: async (id, productoData, imagenFile) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const productoExistente = await client.query(
        "SELECT * FROM productos WHERE idproducto = $1 AND estado = 0",
        [id],
      );

      if (productoExistente.rows.length === 0) {
        throw new Error("Producto no encontrado");
      }

      if (productoData.codigoP) {
        const existingProduct = await client.query(
          "SELECT idproducto FROM productos WHERE codigop = $1 AND estado = 0 AND idproducto != $2",
          [productoData.codigoP.trim(), id]
        );
        
        if (existingProduct.rows.length > 0) {
          throw new Error(`Ya existe otro producto con el código "${productoData.codigoP}"`);
        }
      }

      let imagenBuffer = null;
      if (imagenFile) {
        if (imagenFile.buffer) {
          imagenBuffer = imagenFile.buffer;
        } else if (imagenFile.data) {
          imagenBuffer = Buffer.from(imagenFile.data);
        } else {
          imagenBuffer = Buffer.from(imagenFile);
        }
      }

      let updateQuery = `
        UPDATE productos SET 
          codigop = $1,
          nombre = $2, 
          descripcion = $3, 
          idubicacion = $4,
          precio_compra = $5, 
          precio_venta = $6, 
          stock_minimo = $7,
          codigo_barras = $8,
          idlaboratorio = $9,
          idforma_farmaceutica = $10
      `;

      const queryParams = [
        productoData.codigoP || null,
        productoData.nombre,
        productoData.descripcion,
        productoData.idubicacion,
        productoData.precio_compra,
        productoData.precio_venta,
        productoData.stock_minimo || 0,
        productoData.codigo_barras || null,
        productoData.idlaboratorio,
        productoData.idforma_farmaceutica,
      ];

      if (imagenBuffer) {
        updateQuery += `, imagen = $11 WHERE idproducto = $12`;
        queryParams.push(imagenBuffer, id);
      } else {
        updateQuery += ` WHERE idproducto = $11`;
        queryParams.push(id);
      }

      await client.query(updateQuery, queryParams);

      await client.query(
        "DELETE FROM producto_categorias WHERE idproducto = $1",
        [id],
      );
      if (productoData.categorias && productoData.categorias.length > 0) {
        for (const idcategoria of productoData.categorias) {
          await client.query(
            "INSERT INTO producto_categorias (idproducto, idcategoria) VALUES ($1, $2)",
            [id, idcategoria],
          );
        }
      }

      await client.query(
        "UPDATE lotes set estado = 1 WHERE idproducto = $1",
        [id],
      );

      if (productoData.lotes && productoData.lotes.length > 0) {
        const lotesInvalidos = productoData.lotes.some(
          (lote) =>
            lote.fecha_vencimiento &&
            new Date(lote.fecha_vencimiento).toISOString().split("T")[0] < new Date().toISOString().split("T")[0]
        );

        if (lotesInvalidos) {
          throw new Error(
            "Uno o más lotes tienen una fecha de vencimiento anterior a la fecha actual"
          );
        }

        const lotesExistentes = productoData.lotes.filter(
          (lote) => lote.idlote != null
        );

        for (const lote of lotesExistentes) {
          await client.query(
            `
              UPDATE lotes
              SET
                stock = $1,
                fecha_vencimiento = $2,
                estado = 0
              WHERE idlote = $3
                AND idproducto = $4
            `,
            [
              lote.stock,
              lote.fecha_vencimiento || null,
              lote.idlote,
              id,
            ]
          );
        }

        const lotesNuevos = productoData.lotes.filter(
          (lote) => lote.idlote == null
        );

        if (lotesNuevos.length > 0) {
          const valores = lotesNuevos
            .map(
              (_, index) =>
                `($1, $${index * 2 + 2}, $${index * 2 + 3})`
            )
            .join(", ");

          const params = [
            id,
            ...lotesNuevos.flatMap((lote) => [
              lote.stock,
              lote.fecha_vencimiento || null,
            ]),
          ];

          await client.query(
            `
              INSERT INTO lotes (
                idproducto,
                stock,
                fecha_vencimiento
              )
              VALUES ${valores}
            `,
            params
          );
        }
      }

      const grupoActual = await productsService.obtenerGrupoCompleto(
        client,
        id,
      );
      const todosIdsActuales = [id, ...grupoActual];

      for (const productoId of todosIdsActuales) {
        await client.query(
          "DELETE FROM productos_similares WHERE idproducto = $1 OR idproducto_similar = $1",
          [productoId],
        );
      }

      if (
        productoData.productos_similares &&
        productoData.productos_similares.length > 0
      ) {
        const nuevosIds = [id, ...productoData.productos_similares];
        await productsService.crearRelacionesTransitivas(client, nuevosIds);
      }

      await client.query("COMMIT");

      return await productsService.getProductoById(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  deleteProducto: async (id) => {
    const result = await query(
      "UPDATE productos SET estado = 1 WHERE idproducto = $1",
      [id],
    );

    if (result.rowCount === 0) {
      throw new Error("Producto no encontrado");
    }
  },

  updateStockProducto: async (idproducto, cantidad, idlote) => {
    const result = await query(
      "UPDATE lotes SET stock = stock + $1 WHERE idproducto = $2 AND idlote = $3 AND estado = 0 RETURNING *",
      [cantidad, idproducto, idlote],
    );

    if (result.rows.length === 0) {
      throw new Error("Producto no encontrada");
    }

    return result.rows[0];
  },
  
  addStockProducto: async (idproducto, cantidad, fecha_vencimiento) => {
    const result = await query(
      `
        INSERT INTO public.lotes(idproducto, stock, fecha_vencimiento)
        VALUES ($1, $2, $3)
        RETURNING *;
      `,
      [idproducto, cantidad, fecha_vencimiento],
    );

    if (result.rows.length === 0) {
      throw new Error("Producto no encontrada");
    }

    return result.rows[0];
  },

  createUbicacion: async (data) => {
    const result = await query(
      "INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING *",
      [data.nombre]
    );
    return result.rows[0];
  },

  updateUbicacion: async (id, data) => {
    const result = await query(
      "UPDATE ubicaciones SET nombre = $1 WHERE idubicacion = $2 AND estado = 0 RETURNING *",
      [data.nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Ubicación no encontrada");
    }
    return result.rows[0];
  },

  deleteUbicacion: async (id) => {
    const result = await query(
      "UPDATE ubicaciones SET estado = 1 WHERE idubicacion = $1 AND estado = 0 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Ubicación no encontrada");
    }
  },

  createCategoria: async (data) => {
    const result = await query(
      "INSERT INTO categorias (nombre) VALUES ($1) RETURNING *",
      [data.nombre]
    );
    return result.rows[0];
  },

  updateCategoria: async (id, data) => {
    const result = await query(
      "UPDATE categorias SET nombre = $1 WHERE idcategoria = $2 AND estado = 0 RETURNING *",
      [data.nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Categoría no encontrada");
    }
    return result.rows[0];
  },

  deleteCategoria: async (id) => {
    const result = await query(
      "UPDATE categorias SET estado = 1 WHERE idcategoria = $1 AND estado = 0 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Categoría no encontrada");
    }
  },

  createLaboratorio: async (data) => {
    const result = await query(
      "INSERT INTO laboratorios (nombre_laboratorio) VALUES ($1) RETURNING *",
      [data.nombre]
    );
    return result.rows[0];
  },

  updateLaboratorio: async (id, data) => {
    const result = await query(
      "UPDATE laboratorios SET nombre_laboratorio = $1 WHERE idlaboratorio = $2 AND estado = 0 RETURNING *",
      [data.nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Laboratorio no encontrado");
    }
    return result.rows[0];
  },

  deleteLaboratorio: async (id) => {
    const result = await query(
      "UPDATE laboratorios SET estado = 1 WHERE idlaboratorio = $1 AND estado = 0 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Laboratorio no encontrado");
    }
  },

  createFormaFarmaceutica: async (data) => {
    const result = await query(
      "INSERT INTO forma_farmaceutica (nombre_forma) VALUES ($1) RETURNING *",
      [data.nombre]
    );
    return result.rows[0];
  },

  updateFormaFarmaceutica: async (id, data) => {
    const result = await query(
      "UPDATE forma_farmaceutica SET nombre_forma = $1 WHERE idforma_farmaceutica = $2 AND estado = 0 RETURNING *",
      [data.nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Forma farmacéutica no encontrada");
    }
    return result.rows[0];
  },

  deleteFormaFarmaceutica: async (id) => {
    const result = await query(
      "UPDATE forma_farmaceutica SET estado = 1 WHERE idforma_farmaceutica = $1 AND estado = 0 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Forma farmacéutica no encontrada");
    }
  },
};

module.exports = productsService;