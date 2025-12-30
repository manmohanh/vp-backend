import { Server, Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";

interface AuthSocket extends Socket {
  user?: JwtPayload;
}

const notificationSocket = (io: Server) => {
  io.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;

      socket.user = decoded;
      socket.join(decoded.userId);
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: AuthSocket) => {
    console.log("User connected:", socket.user?.userId);

    socket.on("notification", (payload) => {
        console.log({
            "payload":payload
        })
      io.to(payload.to).emit("notification",payload);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.user?.userId);
    });
  });
};

export default notificationSocket;
