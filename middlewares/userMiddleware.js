import jwt from "jsonwebtoken";

const userAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    req.user = {
      id: decoded.id,
      role: decoded.role,
      branch_id: decoded.branch_id || null
    };

    const headerBranchId = req.headers["x-branch-id"];
    if (headerBranchId) {
      req.user.branch_id = parseInt(headerBranchId, 10);
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default userAuth;
