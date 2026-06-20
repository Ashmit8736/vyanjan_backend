import connectDB from "../config/db.js";

/**
 * Get Token Stats (Daily/Monthly/Yearly and Category-wise)
 */
export const getTokenStatsController = async (req, res) => {
  try {
    const pool = await connectDB();
    const branch_id = req.user.branch_id;

    if (!branch_id) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is missing from user session"
      });
    }

    // Extract query parameters
    const { period = "daily", startDate, endDate, categories } = req.query;

    // Parse categories filter if provided
    let categoryFilterList = null;
    if (categories) {
      if (Array.isArray(categories)) {
        categoryFilterList = categories.map(c => c.trim()).filter(Boolean);
      } else if (typeof categories === "string") {
        categoryFilterList = categories.split(",").map(c => c.trim()).filter(Boolean);
      }
      if (categoryFilterList && categoryFilterList.length === 0) {
        categoryFilterList = null;
      }
    }

    // Build common filter SQL and params
    let filterSql = " WHERE i.branch_id = ? AND item.is_active = 1";
    const commonParams = [branch_id];

    if (startDate && endDate) {
      filterSql += " AND i.created_at >= ? AND i.created_at <= ?";
      commonParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    if (categoryFilterList) {
      const placeholders = categoryFilterList.map(() => "?").join(",");
      filterSql += ` AND item.category IN (${placeholders})`;
      commonParams.push(...categoryFilterList);
    }

    // 1. Fetch Overall Summary
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(ii.quantity), 0) AS total_tokens,
        COALESCE(SUM(ii.subtotal), 0) AS total_amount,
        COUNT(DISTINCT i.id) AS total_orders
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      JOIN items item ON ii.item_id = item.id
      ${filterSql}
    `;
    const [[summaryResult]] = await pool.execute(summaryQuery, commonParams);

    // 2. Fetch Category-wise breakdown
    const categoryQuery = `
      SELECT 
        COALESCE(item.category, 'Uncategorized') AS category,
        COALESCE(SUM(ii.quantity), 0) AS token_count,
        COALESCE(SUM(ii.subtotal), 0) AS total_amount,
        COUNT(DISTINCT i.id) AS order_count
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      JOIN items item ON ii.item_id = item.id
      ${filterSql}
      GROUP BY COALESCE(item.category, 'Uncategorized')
      ORDER BY token_count DESC
    `;
    const [categoryResult] = await pool.execute(categoryQuery, commonParams);

    // 3. Fetch Period-grouped History
    let dateFormatPattern = "%Y-%m-%d"; // default daily
    if (period === "monthly") {
      dateFormatPattern = "%Y-%m";
    } else if (period === "yearly") {
      dateFormatPattern = "%Y";
    }

    const historyQuery = `
      SELECT 
        DATE_FORMAT(i.created_at, '${dateFormatPattern}') AS period_key,
        COALESCE(item.category, 'Uncategorized') AS category,
        COALESCE(SUM(ii.quantity), 0) AS token_count,
        COALESCE(SUM(ii.subtotal), 0) AS total_amount,
        COUNT(DISTINCT i.id) AS order_count
      FROM invoices i
      JOIN invoice_items ii ON i.id = ii.invoice_id
      JOIN items item ON ii.item_id = item.id
      ${filterSql}
      GROUP BY DATE_FORMAT(i.created_at, '${dateFormatPattern}'), COALESCE(item.category, 'Uncategorized')
      ORDER BY period_key DESC, token_count DESC
    `;
    const [historyResult] = await pool.execute(historyQuery, commonParams);

    // 4. Fetch list of all unique active categories for filter dropdowns in UI
    const availableCategoriesQuery = `
      SELECT DISTINCT category 
      FROM items 
      WHERE branch_id = ? AND category IS NOT NULL AND is_active = 1
      ORDER BY category ASC
    `;
    const [categoriesList] = await pool.execute(availableCategoriesQuery, [branch_id]);
    const availableCategories = categoriesList.map(row => row.category);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTokens: Number(summaryResult.total_tokens),
          totalAmount: Number(summaryResult.total_amount),
          totalOrders: Number(summaryResult.total_orders)
        },
        categories: categoryResult.map(c => ({
          category: c.category,
          tokenCount: Number(c.token_count),
          totalAmount: Number(c.total_amount),
          orderCount: Number(c.order_count)
        })),
        history: historyResult.map(h => ({
          periodKey: h.period_key,
          category: h.category,
          tokenCount: Number(h.token_count),
          totalAmount: Number(h.total_amount),
          orderCount: Number(h.order_count)
        })),
        availableCategories
      }
    });

  } catch (error) {
    console.error("❌ Fetch Token Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch token statistics",
      error: error.message
    });
  }
};
