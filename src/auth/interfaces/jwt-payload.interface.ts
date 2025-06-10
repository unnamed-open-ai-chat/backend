export interface AccessJwtPayload {
    sub: string;
    email: string;
    sessionId: string;
    iat?: number;
    exp?: number;
}

export interface RefreshJwtPayload {
    sub: string;
    sessionId: string;
    iat?: number;
    exp?: number;
}
