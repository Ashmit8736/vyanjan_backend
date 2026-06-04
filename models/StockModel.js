import connectDB from "../config/db.js";

const RawMaterialStockModel = {

  upsertStock: async ({
    raw_material_id,
    branch_id,
    quantity_in_consume_unit
  }) => {
    const db = await connectDB();

    const sql = `
      INSERT INTO raw_material_stock
        (raw_material_id, branch_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity)
    `;

    await db.execute(sql, [
      raw_material_id,
      branch_id,
      quantity_in_consume_unit
    ]);
  },

  setStock: async ({
    raw_material_id,
    branch_id,
    quantity_in_consume_unit
  }) => {
    const db = await connectDB();

    const sql = `
      INSERT INTO raw_material_stock
        (raw_material_id, branch_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        quantity = VALUES(quantity)
    `;

    await db.execute(sql, [
      raw_material_id,
      branch_id,
      quantity_in_consume_unit
    ]);
  },

  setStockWithAdjustment: async ({
    raw_material_id,
    branch_id,
    quantity_in_consume_unit,
    reason,
    comments
  }) => {
    const pool = await connectDB();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Fetch current/previous quantity
      const [rows] = await conn.execute(
        `SELECT quantity FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?`,
        [raw_material_id, branch_id]
      );
      const previousQuantity = rows.length ? Number(rows[0].quantity) : 0.0;

      // 2. Set/Upsert stock
      await conn.execute(
        `INSERT INTO raw_material_stock (raw_material_id, branch_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [raw_material_id, branch_id, quantity_in_consume_unit]
      );

      // 3. Log stock adjustment
      await conn.execute(
        `INSERT INTO stock_adjustments (raw_material_id, branch_id, adjusted_quantity, previous_quantity, reason, comments)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [raw_material_id, branch_id, quantity_in_consume_unit, previousQuantity, reason || 'Other', comments || null]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },



  getAvailableStockByBranch: async (branch_id) => {
    const db = await connectDB();
    
    const sql = `
     SELECT
  rm.id AS raw_material_id,
  rm.name AS raw_material_name,
  rm.category,

  rms.quantity AS available_quantity_consume,

  cu.unit_name AS consume_unit,
  cu.unit_symbol AS consume_unit_symbol,

  (rms.quantity / rm.conversion_factor) 
    AS available_quantity_purchase,

  pu.unit_name AS purchase_unit,
  pu.unit_symbol AS purchase_unit_symbol

FROM raw_material_stock rms
JOIN raw_materials rm ON rm.id = rms.raw_material_id
JOIN units cu ON cu.id = rm.consume_unit_id
JOIN units pu ON pu.id = rm.purchase_unit_id

WHERE rms.branch_id = ?
  AND rm.is_active = 1
ORDER BY rm.category, rm.name;

    `;

    const [rows] = await db.execute(sql, [branch_id]);
    return rows;
  },

  getRawMaterialForStock: async (raw_material_id) => {
    const db = await connectDB();

    const [rows] = await db.execute(
      `
      SELECT
        consume_unit_id,
        purchase_unit_id,
        conversion_factor
      FROM raw_materials
      WHERE id = ?
      `,
      [raw_material_id]
    );

    return rows.length ? rows[0] : null;
  },

  getStockSummaryReport: async ({
    branch_id,
    fromDate,
    toDate,
    category,
    rawMaterial,
    unitType
  }) => {
    const pool = await connectDB();

    const from = fromDate ? `${fromDate} 00:00:00` : `${new Date().toISOString().slice(0, 10)} 00:00:00`;
    const to = toDate ? `${toDate} 23:59:59` : `${new Date().toISOString().slice(0, 10)} 23:59:59`;

    let rmConditions = ["rm.branch_id = ?", "rm.is_active = 1"];
    let rmParams = [branch_id];

    if (category && category !== "All") {
      rmConditions.push("rm.category = ?");
      rmParams.push(category);
    }
    if (rawMaterial) {
      rmConditions.push("rm.name LIKE ?");
      rmParams.push(`%${rawMaterial}%`);
    }

    const rmSql = `
      SELECT rm.id, rm.name, rm.category,
             rms.quantity AS current_stock,
             pu.unit_symbol AS purchase_unit,
             cu.unit_symbol AS consume_unit,
             rm.conversion_factor
      FROM raw_materials rm
      LEFT JOIN raw_material_stock rms ON rms.raw_material_id = rm.id AND rms.branch_id = rm.branch_id
      JOIN units pu ON pu.id = rm.purchase_unit_id
      JOIN units cu ON cu.id = rm.consume_unit_id
      WHERE ${rmConditions.join(" AND ")}
      ORDER BY rm.category, rm.name
    `;
    const [rawMaterials] = await pool.execute(rmSql, rmParams);

    const [purchases] = await pool.execute(`
      SELECT spi.raw_material_id,
             SUM(CASE WHEN spi.created_at >= ? AND spi.created_at <= ? THEN spi.quantity ELSE 0 END) AS in_range_purchase,
             SUM(CASE WHEN spi.created_at > ? THEN spi.quantity ELSE 0 END) AS after_range_purchase
      FROM stock_purchase_items spi
      WHERE spi.branch_id = ?
      GROUP BY spi.raw_material_id
    `, [from, to, to, branch_id]);

    const [wastage] = await pool.execute(`
      SELECT wr.raw_material_id,
             SUM(CASE WHEN wr.created_at >= ? AND wr.created_at <= ? THEN wr.quantity ELSE 0 END) AS in_range_wastage,
             SUM(CASE WHEN wr.created_at > ? THEN wr.quantity ELSE 0 END) AS after_range_wastage
      FROM wastage_records wr
      WHERE wr.branch_id = ?
      GROUP BY wr.raw_material_id
    `, [from, to, to, branch_id]);

    const [production] = await pool.execute(`
      SELECT pm.raw_material_id,
             SUM(CASE WHEN pm.created_at >= ? AND pm.created_at <= ? THEN pm.quantity ELSE 0 END) AS in_range_production,
             SUM(CASE WHEN pm.created_at > ? THEN pm.quantity ELSE 0 END) AS after_range_production
      FROM production_materials pm
      JOIN production p ON p.id = pm.production_id
      WHERE p.branch_id = ?
      GROUP BY pm.raw_material_id
    `, [from, to, to, branch_id]);

    const [adjustments] = await pool.execute(`
      SELECT sa.raw_material_id,
             SUM(CASE WHEN sa.adjusted_at >= ? AND sa.adjusted_at <= ? AND sa.adjusted_quantity > sa.previous_quantity THEN sa.adjusted_quantity - sa.previous_quantity ELSE 0 END) AS in_range_excess,
             SUM(CASE WHEN sa.adjusted_at >= ? AND sa.adjusted_at <= ? AND sa.adjusted_quantity < sa.previous_quantity THEN sa.previous_quantity - sa.adjusted_quantity ELSE 0 END) AS in_range_shortage,
             SUM(CASE WHEN sa.adjusted_at > ? THEN sa.adjusted_quantity - sa.previous_quantity ELSE 0 END) AS after_range_adjustment
      FROM stock_adjustments sa
      WHERE sa.branch_id = ?
      GROUP BY sa.raw_material_id
    `, [from, to, from, to, to, branch_id]);

    const [sales] = await pool.execute(`
      SELECT rmat.raw_material_id,
             SUM(CASE WHEN si.created_at >= ? AND si.created_at <= ? THEN sii.quantity * (rmat.quantity / r.item_quantity) ELSE 0 END) AS in_range_sales,
             SUM(CASE WHEN si.created_at > ? THEN sii.quantity * (rmat.quantity / r.item_quantity) ELSE 0 END) AS after_range_sales
      FROM sales_invoices si
      JOIN sales_invoice_items sii ON sii.invoice_id = si.id
      JOIN items i ON i.name = sii.item_name AND i.branch_id = si.branch_id AND i.is_active = 1
      JOIN recipes r ON r.item_id = i.id AND r.branch_id = si.branch_id AND r.is_active = 1
      JOIN recipe_materials rmat ON rmat.recipe_id = r.id
      WHERE si.branch_id = ?
      GROUP BY rmat.raw_material_id
    `, [from, to, to, branch_id]);

    const purchaseMap = new Map(purchases.map(p => [p.raw_material_id, p]));
    const wastageMap = new Map(wastage.map(w => [w.raw_material_id, w]));
    const productionMap = new Map(production.map(pr => [pr.raw_material_id, pr]));
    const adjustmentMap = new Map(adjustments.map(a => [a.raw_material_id, a]));
    const salesMap = new Map(sales.map(s => [s.raw_material_id, s]));

    return rawMaterials.map(rm => {
      const rmId = rm.id;
      const convFactor = Number(rm.conversion_factor || 1);

      const currentStockConsume = Number(rm.current_stock || 0);

      const purchaseData = purchaseMap.get(rmId) || { in_range_purchase: 0, after_range_purchase: 0 };
      const wastageData = wastageMap.get(rmId) || { in_range_wastage: 0, after_range_wastage: 0 };
      const prodData = productionMap.get(rmId) || { in_range_production: 0, after_range_production: 0 };
      const adjData = adjustmentMap.get(rmId) || { in_range_excess: 0, in_range_shortage: 0, after_range_adjustment: 0 };
      const salesData = salesMap.get(rmId) || { in_range_sales: 0, after_range_sales: 0 };

      const pInRangeConsume = Number(purchaseData.in_range_purchase) * convFactor;
      const pAfterRangeConsume = Number(purchaseData.after_range_purchase) * convFactor;

      const wInRangeConsume = Number(wastageData.in_range_wastage) * convFactor;
      const wAfterRangeConsume = Number(wastageData.after_range_wastage) * convFactor;

      const prInRangeConsume = Number(prodData.in_range_production);
      const prAfterRangeConsume = Number(prodData.after_range_production);

      const excessInRangeConsume = Number(adjData.in_range_excess);
      const shortageInRangeConsume = Number(adjData.in_range_shortage);
      const adjAfterRangeConsume = Number(adjData.after_range_adjustment);

      const salesInRangeConsume = Number(salesData.in_range_sales);
      const salesAfterRangeConsume = Number(salesData.after_range_sales);

      // Compute closing stock (end of range, T2 + 1) in consume units
      const closingStockConsume = currentStockConsume 
        - pAfterRangeConsume 
        + wAfterRangeConsume 
        + prAfterRangeConsume 
        + salesAfterRangeConsume 
        - adjAfterRangeConsume;

      // Compute opening stock (start of range, T1) in consume units
      const openingStockConsume = closingStockConsume 
        - pInRangeConsume 
        + wInRangeConsume 
        + prInRangeConsume 
        + salesInRangeConsume 
        - excessInRangeConsume 
        + shortageInRangeConsume;

      // Convert to requested unitType ('Purchase' or 'Consume')
      const isPurchase = unitType !== "Consume";
      const scale = isPurchase ? convFactor : 1;

      return {
        raw_material_id: rmId,
        raw_material_name: rm.name,
        category: rm.category,
        unit: isPurchase ? rm.purchase_unit : rm.consume_unit,
        
        opening: openingStockConsume / scale,
        purchase: pInRangeConsume / scale,
        excess: excessInRangeConsume / scale,
        totalIn: (openingStockConsume + pInRangeConsume + excessInRangeConsume) / scale,
        
        consumed: salesInRangeConsume / scale,
        wastage: wInRangeConsume / scale,
        normalLoss: 0.0,
        transfer: 0.0,
        shortage: shortageInRangeConsume / scale,
        production: -(prInRangeConsume / scale),
        
        totalOut: (salesInRangeConsume + wInRangeConsume + shortageInRangeConsume) / scale,
        closing: closingStockConsume / scale
      };
    });
  },

  getDashboardStats: async (branch_id) => {
    const db = await connectDB();

    // 1. Profit calculation
    // Revenue
    const [revResult] = await db.execute(
      `SELECT IFNULL(SUM(total), 0) AS revenue FROM sales_invoices WHERE branch_id = ?`,
      [branch_id]
    );
    const revenue = Number(revResult[0].revenue);

    // Ingredient cost (Cost of goods sold based on active recipes)
    const [costResult] = await db.execute(
      `SELECT IFNULL(SUM(sii.quantity * (rmat.quantity / r.item_quantity) * (rm.purchase_price / rm.conversion_factor)), 0) AS ingredient_cost
       FROM sales_invoices si
       JOIN sales_invoice_items sii ON sii.invoice_id = si.id
       JOIN items i ON i.name = sii.item_name AND i.branch_id = si.branch_id AND i.is_active = 1
       JOIN recipes r ON r.item_id = i.id AND r.branch_id = si.branch_id AND r.is_active = 1
       JOIN recipe_materials rmat ON rmat.recipe_id = r.id
       JOIN raw_materials rm ON rm.id = rmat.raw_material_id
       WHERE si.branch_id = ?`,
      [branch_id]
    );
    const ingredientCost = Number(costResult[0].ingredient_cost);

    // Wastage cost
    const [wastageCostResult] = await db.execute(
      `SELECT IFNULL(SUM(value), 0) AS wastage_cost FROM wastage_records WHERE branch_id = ?`,
      [branch_id]
    );
    const wastageCost = Number(wastageCostResult[0].wastage_cost);

    // Profit
    const profit = revenue - ingredientCost - wastageCost;

    // 2. Stock Value
    const [stockValueResult] = await db.execute(
      `SELECT IFNULL(SUM(rms.quantity * (rm.purchase_price / rm.conversion_factor)), 0) AS stock_value
       FROM raw_material_stock rms
       JOIN raw_materials rm ON rm.id = rms.raw_material_id
       WHERE rms.branch_id = ? AND rm.is_active = 1`,
      [branch_id]
    );
    const stockValue = Number(stockValueResult[0].stock_value);

    // 3. Low stock count
    const [lowStockResult] = await db.execute(
      `SELECT COUNT(*) AS low_stock_count
       FROM raw_materials rm
       LEFT JOIN raw_material_stock rms ON rms.raw_material_id = rm.id AND rms.branch_id = rm.branch_id
       WHERE rm.branch_id = ?
         AND rm.is_active = 1
         AND IFNULL(rms.quantity / rm.conversion_factor, 0) < rm.minimum_stock_level`,
      [branch_id]
    );
    const lowStockCount = Number(lowStockResult[0].low_stock_count);

    // 4. Wastage quantity (in Kg)
    const [wastageQtyResult] = await db.execute(
      `SELECT IFNULL(SUM(wr.quantity), 0) AS total_wastage_qty FROM wastage_records wr WHERE wr.branch_id = ?`,
      [branch_id]
    );
    const totalWastageQty = Number(wastageQtyResult[0].total_wastage_qty);

    // 5. Monthly purchase vs sales (last 6 months)
    const [purchasesResult] = await db.execute(
      `SELECT DATE_FORMAT(created_at, '%b') AS month, MONTH(created_at) AS month_num, SUM(quantity * unit_price) AS total_purchase
       FROM stock_purchase_items
       WHERE branch_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY MONTH(created_at)
       ORDER BY MONTH(created_at) ASC`,
      [branch_id]
    );

    const [salesResult] = await db.execute(
      `SELECT DATE_FORMAT(created_at, '%b') AS month, MONTH(created_at) AS month_num, SUM(total) AS total_sales
       FROM sales_invoices
       WHERE branch_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY MONTH(created_at)
       ORDER BY MONTH(created_at) ASC`,
      [branch_id]
    );

    // Combine purchases and sales results into last 6 months list
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mName = monthNames[d.getMonth()];
      const mNum = d.getMonth() + 1;
      
      const purchaseEntry = purchasesResult.find(p => p.month === mName || p.month_num === mNum);
      const salesEntry = salesResult.find(s => s.month === mName || s.month_num === mNum);

      chartData.push({
        month: mName,
        purchase: purchaseEntry ? Number(purchaseEntry.total_purchase) : 0,
        consumption: salesEntry ? Number(salesEntry.total_sales) : 0
      });
    }

    // 6. Top materials by stock value (share)
    const [topMaterialsResult] = await db.execute(
      `SELECT rm.name, SUM(rms.quantity * (rm.purchase_price / rm.conversion_factor)) AS stock_val
       FROM raw_material_stock rms
       JOIN raw_materials rm ON rm.id = rms.raw_material_id
       WHERE rms.branch_id = ? AND rm.is_active = 1
       GROUP BY rm.id
       ORDER BY stock_val DESC
       LIMIT 5`,
      [branch_id]
    );

    const pieData = [];
    if (stockValue > 0) {
      let topSum = 0;
      topMaterialsResult.forEach(item => {
        const val = Number(item.stock_val);
        const percent = Math.round((val / stockValue) * 100);
        if (percent > 0) {
          pieData.push({ name: item.name, value: percent });
          topSum += percent;
        }
      });
      const topActualValueSum = topMaterialsResult.reduce((sum, item) => sum + Number(item.stock_val), 0);
      if (topSum < 100 && (stockValue - topActualValueSum) > 0.01) {
        pieData.push({ name: "Others", value: 100 - topSum });
      }
    }

    // 7. Expiry Items List
    const [expiryResult] = await db.execute(
      `SELECT
         rm.name AS item,
         DATE_FORMAT(DATE_ADD(spi.created_at, INTERVAL rm.expiry_days DAY), '%d-%b-%Y') AS date,
         CONCAT(ROUND(SUM(spi.quantity), 2), ' ', u.unit_symbol) AS qty,
         DATE_ADD(spi.created_at, INTERVAL rm.expiry_days DAY) AS raw_expiry_date
       FROM stock_purchase_items spi
       JOIN raw_materials rm ON rm.id = spi.raw_material_id
       JOIN units u ON u.id = rm.purchase_unit_id
       WHERE spi.branch_id = ?
         AND rm.expiry_days IS NOT NULL
         AND rm.expiry_days > 0
       GROUP BY spi.raw_material_id, DATE(spi.created_at)
       HAVING raw_expiry_date <= DATE_ADD(NOW(), INTERVAL 30 DAY)
       ORDER BY raw_expiry_date ASC
       LIMIT 5`,
      [branch_id]
    );

    // 8. Low Stock Alerts List
    const [alertsResult] = await db.execute(
      `SELECT rm.name, ROUND(rms.quantity / rm.conversion_factor, 2) AS current_qty, u.unit_symbol AS unit
       FROM raw_materials rm
       LEFT JOIN raw_material_stock rms ON rms.raw_material_id = rm.id AND rms.branch_id = rm.branch_id
       JOIN units u ON u.id = rm.purchase_unit_id
       WHERE rm.branch_id = ?
         AND rm.is_active = 1
         AND IFNULL(rms.quantity / rm.conversion_factor, 0) < rm.minimum_stock_level
       LIMIT 3`,
      [branch_id]
    );

    return {
      cards: {
        profit,
        stockValue,
        lowStockCount,
        totalWastageQty
      },
      chartData,
      pieData,
      expiryItems: expiryResult,
      alerts: alertsResult
    };
  }
};

export default RawMaterialStockModel;


export const getCurrentStock = async ({ category, rawMaterial }) => {
  const db = await connectDB();   // ✅ ADD THIS LINE

  let conditions = [];
  let params = [];

  if (category && category !== "All") {
    conditions.push("rm.category = ?");
    params.push(category);
  }

  if (rawMaterial) {
    conditions.push("rm.name LIKE ?");
    params.push(`%${rawMaterial}%`);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const sql = `
    SELECT
      rm.category AS category,
      rm.name AS rawMaterial,
      rms.quantity AS quantity,
      cu.unit_symbol AS unit,
      IFNULL(AVG(spi.unit_price), 0) AS price,
      (rms.quantity * IFNULL(AVG(spi.unit_price), 0)) AS total
    FROM raw_material_stock rms
    JOIN raw_materials rm ON rm.id = rms.raw_material_id
    JOIN units cu ON cu.id = rm.consume_unit_id
    LEFT JOIN stock_purchase_items spi
      ON spi.raw_material_id = rm.id
    ${whereClause}
    GROUP BY rm.id, rms.quantity, cu.unit_symbol
    ORDER BY rm.name ASC
  `;

  const [rows] = await db.execute(sql, params);
  return rows;
};
