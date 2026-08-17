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

  // Obtener solo id y nombre para selects
  getTodosProductosSelect: async () => {
    const result = await query(`
      SELECT idproducto, nombre 
      FROM productos 
      WHERE estado = 0 
      ORDER BY nombre
    `);
    return result.rows;
  },

  getTodosProductos: async (page, limit) => {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `
      SELECT COUNT(DISTINCT p.idproducto) as total
      FROM productos p
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN producto_tipos pt ON p.idproducto = pt.idproducto
      LEFT JOIN tipos tp ON pt.idtipo = tp.idtipo
      LEFT JOIN laboratorios l ON l.idlaboratorio = p.idlaboratorio
      WHERE p.estado = 0 
    `,
      [],
    );

    const total = parseInt(countResult.rows[0].total, 10);

    const result = await query(
      `
      SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        u.idubicacion,
        l.nombre_laboratorio as laboratorio_nombre,
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
      ) lt ON true
      WHERE p.estado = 0 
      GROUP BY p.idproducto, u.nombre, u.idubicacion, l.nombre_laboratorio, lt.stock_total, lt.lotes
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
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          idubicacion: producto.idubicacion,
          ubicacion_nombre: producto.ubicacion_nombre || "Sin ubicación",
          idlaboratorio: producto.idlaboratorio || 0,
          laboratorio_nombre: producto.laboratorio_nombre || "Sin laboratorio",
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
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  buscarProductos: async (termino, categoria, laboratorio, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `
      SELECT COUNT(DISTINCT p.idproducto) as total
      FROM productos p
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN producto_tipos pt ON p.idproducto = pt.idproducto
      LEFT JOIN tipos tp ON pt.idtipo = tp.idtipo
      LEFT JOIN laboratorios l ON l.idlaboratorio = p.idlaboratorio
      WHERE p.estado = 0 
        AND (
              (p.nombre ILIKE $1 OR p.descripcion ILIKE $1 
              OR c.nombre ILIKE $1 OR tp.nombre ILIKE $1
              OR p.codigo_barras ILIKE $1)
              OR (c.nombre LIKE $2)
              OR (l.nombre_laboratorio LIKE $3)
            )
    `,
      [`%${termino}%`, categoria, laboratorio],
    );

    const total = parseInt(countResult.rows[0].total, 10);

    const result = await query(
      `
      SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        u.idubicacion,
        l.nombre_laboratorio as laboratorio_nombre,
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
      ) lt ON true
      WHERE p.estado = 0 
        AND (
              (p.nombre ILIKE $1 OR p.descripcion ILIKE $1 
              OR c.nombre ILIKE $1 OR tp.nombre ILIKE $1
              OR p.codigo_barras ILIKE $1)
              OR (c.nombre LIKE $4)
              OR (l.nombre_laboratorio LIKE $5)
            )
      GROUP BY p.idproducto, u.nombre, u.idubicacion, l.nombre_laboratorio, lt.stock_total, lt.lotes
      ORDER BY p.nombre
      LIMIT $2 OFFSET $3
    `,
      [`%${termino}%`, limit, offset, categoria, laboratorio],
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
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          idubicacion: producto.idubicacion,
          ubicacion_nombre: producto.ubicacion_nombre || "Sin ubicación",
          idlaboratorio: producto.idlaboratorio || 0,
          laboratorio_nombre: producto.laboratorio_nombre || "Sin laboratorio",
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
      page,
      limit,
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
        ARRAY_AGG(DISTINCT c.nombre) as categorias,
        ARRAY_AGG(DISTINCT tp.nombre) as tipos
      FROM productos p
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria
      LEFT JOIN producto_tipos pt ON p.idproducto = pt.idproducto
      LEFT JOIN tipos tp ON pt.idtipo = tp.idtipo
      WHERE p.idproducto = $1 AND p.estado = 0
      GROUP BY p.idproducto, u.nombre, u.idubicacion
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

    // Obtener productos similares (con relaciones transitivas)
    const similaresResult = await query(
      `
      WITH RECURSIVE similar_products AS (
        -- Relaciones directas
        SELECT DISTINCT 
          CASE 
            WHEN idproducto = $1::integer THEN idproducto_similar
            WHEN idproducto_similar = $1::integer THEN idproducto
          END as idproducto_relacionado
        FROM productos_similares
        WHERE idproducto = $1::integer OR idproducto_similar = $1::integer
        
        UNION
        
        -- Relaciones transitivas
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
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      idubicacion: producto.idubicacion,
      ubicacion_nombre: producto.ubicacion_nombre,
      ubicacion: producto.ubicacion_nombre,
      categorias: producto.categorias?.filter((c) => c !== null) || [],
      estado: producto.estado,
      imagen: imagenBase64,
      precio_venta: producto.precio_venta,
      precio_compra: producto.precio_compra,
      stock: producto.stock,
      stock_minimo: producto.stock_minimo,
      codigo_barras: producto.codigo_barras,
      productos_similares: similaresResult.rows,
    };

    return productoProcesado;
  },

  // Función para crear relaciones transitivas completas
  crearRelacionesTransitivas: async (client, productoIds) => {
    if (!productoIds || productoIds.length < 2) return;

    // Eliminar duplicados y asegurar que sean números
    const idsUnicos = [...new Set(productoIds.map((id) => parseInt(id)))];

    console.log(
      `Creando relaciones transitivas para los IDs: ${idsUnicos.join(", ")}`,
    );

    // Crear todas las combinaciones posibles entre los productos (grafo completo)
    for (let i = 0; i < idsUnicos.length; i++) {
      for (let j = i + 1; j < idsUnicos.length; j++) {
        const id1 = idsUnicos[i];
        const id2 = idsUnicos[j];

        if (id1 !== id2) {
          // Verificar si la relación ya existe
          const existe = await client.query(
            "SELECT 1 FROM productos_similares WHERE (idproducto = $1 AND idproducto_similar = $2) OR (idproducto = $2 AND idproducto_similar = $1)",
            [id1, id2],
          );

          if (existe.rows.length === 0) {
            // Insertar relación bidireccional
            await client.query(
              "INSERT INTO productos_similares (idproducto, idproducto_similar) VALUES ($1, $2), ($2, $1)",
              [id1, id2],
            );
            console.log(`Relación creada entre ${id1} y ${id2}`);
          } else {
            console.log(`Relación ya existente entre ${id1} y ${id2}`);
          }
        }
      }
    }
  },

  // Función para obtener todos los productos relacionados en un grupo
  obtenerGrupoCompleto: async (client, productoId) => {
    const id = parseInt(productoId);

    // Obtener todas las relaciones donde participe este producto
    const result = await client.query(
      `
      SELECT DISTINCT idproducto, idproducto_similar
      FROM productos_similares
      WHERE idproducto = $1 OR idproducto_similar = $1
      `,
      [id],
    );

    // Recopilar todos los IDs únicos del grupo
    const idsRelacionados = new Set();
    idsRelacionados.add(id);

    for (const row of result.rows) {
      idsRelacionados.add(row.idproducto);
      idsRelacionados.add(row.idproducto_similar);
    }

    // Para cada nuevo ID, buscar más relaciones (profundidad)
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

    // Remover el producto original del resultado
    const resultado = Array.from(idsRelacionados).filter(
      (idItem) => idItem !== id,
    );
    console.log(`Grupo completo para producto ${id}: ${resultado.join(", ")}`);

    return resultado;
  },

  createProducto: async (productoData, imagenFile) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

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
          nombre, descripcion, idubicacion, imagen, 
          precio_compra, precio_venta, idlaboratorio, stock_minimo, codigo_barras, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0) RETURNING *`,
        [
          productoData.nombre,
          productoData.descripcion,
          productoData.idubicacion,
          imagenBuffer,
          productoData.precio_compra,
          productoData.precio_venta,
          productoData.idlaboratorio,
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

      // Crear relaciones transitivas completas
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

      // Verificar que el producto existe
      const productoExistente = await client.query(
        "SELECT * FROM productos WHERE idproducto = $1 AND estado = 0",
        [id],
      );

      if (productoExistente.rows.length === 0) {
        throw new Error("Producto no encontrado");
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

      // Construir la consulta de actualización
      let updateQuery = `
        UPDATE productos SET 
          nombre = $1, 
          descripcion = $2, 
          idubicacion = $3,
          precio_compra = $4, 
          precio_venta = $5, 
          stock_minimo = $6,
          codigo_barras = $7,
          idlaboratorio = $8
      `;

      const queryParams = [
        productoData.nombre,
        productoData.descripcion,
        productoData.idubicacion,
        productoData.precio_compra,
        productoData.precio_venta,
        productoData.stock_minimo || 0,
        productoData.codigo_barras || null,
        productoData.idlaboratorio
      ];

      if (imagenBuffer) {
        updateQuery += `, imagen = $9 WHERE idproducto = $10`;
        queryParams.push(imagenBuffer, id);
      } else {
        updateQuery += ` WHERE idproducto = $9`;
        queryParams.push(id);
      }

      await client.query(updateQuery, queryParams);

      // Actualizar categorías (eliminar existentes y insertar nuevas)
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
        "DELETE FROM lotes WHERE idproducto = $1",
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

        const valores = productoData.lotes
          .map(
            (_, index) =>
              `($1, $${index * 2 + 2}, $${index * 2 + 3})`
          )
          .join(", ");

        const params = [
          id,
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

      // Obtener el grupo completo de productos relacionados actualmente
      const grupoActual = await productsService.obtenerGrupoCompleto(
        client,
        id,
      );
      const todosIdsActuales = [id, ...grupoActual];

      // Eliminar todas las relaciones existentes del grupo completo
      for (const productoId of todosIdsActuales) {
        await client.query(
          "DELETE FROM productos_similares WHERE idproducto = $1 OR idproducto_similar = $1",
          [productoId],
        );
      }

      console.log(
        `Eliminadas relaciones para el grupo: ${todosIdsActuales.join(", ")}`,
      );

      // Crear nuevas relaciones con los productos similares seleccionados
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
    // Soft delete - marcar como eliminado
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
};

module.exports = productsService;
