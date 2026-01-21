import jwt from "jsonwebtoken";

const superAdminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    req.superAdmin = decoded;
    next();

  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default superAdminAuth;

export const userAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Allow USER or SUPER_ADMIN
    if (decoded.role !== "USER" && decoded.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    req.user = decoded;
    next();

  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
