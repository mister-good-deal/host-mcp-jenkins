import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts }) => `${ts} [${level}]: ${message}`);

let logger: winston.Logger;

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export function initLogger(level: LogLevel = "info"): winston.Logger {
    logger = winston.createLogger({
        level: level === "silent" ? "error" : level,
        silent: level === "silent",
        format: combine(
            timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            colorize(),
            logFormat
        ),
        transports: [
            new winston.transports.Stream({
                stream: process.stderr
            })
        ]
    });

    return logger;
}

export function getLogger(): winston.Logger {
    if (!logger) return initLogger();

    return logger;
}
