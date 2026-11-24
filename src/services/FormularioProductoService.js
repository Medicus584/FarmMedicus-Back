const { pool } = require("../../db");

const resolverCategorias = async (client, categorias) => {
	const recibidos = (categorias || []).map((c) => parseInt(c, 10));

	const invalidos = recibidos.filter((c) => !Number.isInteger(c) || c <= 0);
	if (invalidos.length > 0) {
		throw new Error(
			"Hay categorías no válidas en el formulario. Vuelve a seleccionarlas de la lista."
		);
	}

	const ids = [...new Set(recibidos)];
	if (ids.length === 0) return [];

	const { rows } = await client.query(
		"SELECT idcategoria FROM categorias WHERE idcategoria = ANY($1::int[]) AND estado = 0",
		[ids]
	);

	const faltantes = ids.filter((id) => !rows.some((r) => r.idcategoria === id));
	if (faltantes.length > 0) {
		throw new Error(`Categorías no válidas: ${faltantes.join(", ")}`);
	}

	return ids;
};

class FormularioProductoService {
	async createProducto (productoData, imagenFile) {
		const client = await pool.connect();
			
		try {
			await client.query('BEGIN');

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
				precio_compra, precio_venta, stock, estado
				) VALUES ($1, $2, $3, $4, $5, $6, $7, 0) RETURNING *`,
				[
					productoData.nombre, 
					productoData.descripcion, 
					productoData.idubicacion,
					imagenBuffer,
					productoData.precio_compra,
					productoData.precio_venta,
					productoData.stock
				]
			);

			const producto = productoResult.rows[0];

			const categoriasCreate = await resolverCategorias(
				client,
				productoData.categorias
			);
			for (const idcategoria of categoriasCreate) {
				await client.query(
					'INSERT INTO producto_categorias (idproducto, idcategoria) VALUES ($1, $2)',
					[producto.idproducto, idcategoria]
				);
			}

			await client.query('COMMIT');
				
			return await this.getProductoById(producto.idproducto);
			
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	}

	async updateProducto (id, productoData, imagenFile) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const productoExistente = await client.query(
        'SELECT * FROM productos WHERE idproducto = $1 AND estado = 0',
        [id]
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

      // Actualizar producto principal
      await client.query(
        `UPDATE productos SET 
          nombre = $1, 
          descripcion = $2, 
          idubicacion = $3, 
          imagen = $4, 
          precio_compra = $5, 
          precio_venta = $6, 
          stock = $7,
          stock_minimo = $8,
          estado = $9
        WHERE idproducto = $10`,
        [
          productoData.nombre, 
          productoData.descripcion, 
          productoData.idubicacion,
          imagenBuffer,
          productoData.precio_compra,
          productoData.precio_venta,
          productoData.stock,
          productoData.stock_minimo || 0,  // $8
          0,
          id
        ]
      );
        
      // Actualizar categorías (eliminar existentes y insertar nuevas)
      await client.query('DELETE FROM producto_categorias WHERE idproducto = $1', [id]);
      const categoriasUpdate = await resolverCategorias(
        client,
        productoData.categorias
      );
      for (const idcategoria of categoriasUpdate) {
        await client.query(
          'INSERT INTO producto_categorias (idproducto, idcategoria) VALUES ($1, $2)',
          [id, idcategoria]
        );
      }

      await client.query('COMMIT');
      
      return await this.getProductoById(id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getProductoById(id) {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        p.*,
        u.nombre as ubicacion_nombre,
        u.idubicacion,
        ARRAY_AGG(DISTINCT c.nombre) FILTER (WHERE c.nombre IS NOT NULL) as categorias
      FROM productos p
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN categorias c ON pc.idcategoria = c.idcategoria AND c.estado = 0
      WHERE p.idproducto = $1 AND p.estado = 0
      GROUP BY p.idproducto, u.nombre, u.idubicacion
    `, [id]);

    if (result.rows.length === 0) {
      throw new Error("Producto no encontrado");
    }

    const producto = result.rows[0];

    let imagenBase64 = '';
    if (producto.imagen) {
      try {
        const base64 = producto.imagen.toString('base64');
        imagenBase64 = `data:image/jpeg;base64,${base64}`;
      } catch (error) {
        console.error(`Error al convertir imagen del producto ${producto.idproducto}:`, error);
        imagenBase64 = '';
      }
    }

    const productoProcesado = {
      idproducto: producto.idproducto,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      idubicacion: producto.idubicacion,
      ubicacion_nombre: producto.ubicacion_nombre,
      ubicacion: producto.ubicacion_nombre,
      categorias: producto.categorias?.filter(c => c !== null) || [],
      estado: producto.estado,
      imagen: imagenBase64,
      precio_venta: producto.precio_venta,
      precio_compra: producto.precio_compra,
      stock_minimo: producto.stock_minimo,
      stock: producto.stock
    };

    return productoProcesado;
  }

    async deleteProducto(idproducto) {
        const queryStr = `
            UPDATE productos 
            SET estado = 1 
            WHERE idproducto = $1 AND estado = 0
            RETURNING idproducto
        `;
        
        const result = await pool.query(queryStr, [idproducto]);
        
        if (result.rowCount === 0) {
            throw new Error("Producto no encontrado o ya eliminado");
        }
    }
}

module.exports = new FormularioProductoService();