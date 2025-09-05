import crypto from 'crypto';

// 사용자별 고유한 암호화 키 생성 (사용자 ID + 시스템 비밀키 기반)
function getUserEncryptionKey(userId: string): string {
  const systemSecret = process.env.ENCRYPTION_MASTER_KEY;
  if (!systemSecret) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
  }
  
  // 사용자 ID와 시스템 비밀키를 조합하여 고유한 키 생성
  return crypto
    .createHash('sha256')
    .update(`${userId}:${systemSecret}`)
    .digest('hex')
    .substring(0, 32); // AES-256 requires 32 byte key
}

// API 키 암호화 (사용자별 고유 키 사용)
export function encryptApiKey(apiKey: string, userId: string): { encryptedKey: string; salt: string } {
  try {
    // 랜덤 솔트 생성
    const salt = crypto.randomBytes(16).toString('hex');
    
    // 사용자별 고유 암호화 키 생성
    const userKey = getUserEncryptionKey(userId);
    
    // 솔트와 사용자 키를 조합한 최종 암호화 키
    const finalKey = crypto
      .createHash('sha256')
      .update(`${userKey}:${salt}`)
      .digest();
    
    // AES-256-CBC으로 암호화 (최신 함수 사용)
    const iv = crypto.randomBytes(16); // CBC uses 16 byte IV
    const cipher = crypto.createCipheriv('aes-256-cbc', finalKey, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // IV + 암호화된 데이터를 결합
    const encryptedKey = iv.toString('hex') + ':' + encrypted;
    
    return { encryptedKey, salt };
  } catch (error) {
    console.error('API 키 암호화 실패:', error);
    throw new Error('API 키 암호화에 실패했습니다');
  }
}

// API 키 복호화 (사용자별 고유 키 사용)
export function decryptApiKey(encryptedKey: string, salt: string, userId: string): string {
  try {
    // 사용자별 고유 암호화 키 생성
    const userKey = getUserEncryptionKey(userId);
    
    // 솔트와 사용자 키를 조합한 최종 복호화 키
    const finalKey = crypto
      .createHash('sha256')
      .update(`${userKey}:${salt}`)
      .digest();
    
    // 암호화된 데이터 분리 (IV:EncryptedData)
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) {
      throw new Error('잘못된 암호화 데이터 형식');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // AES-256-CBC으로 복호화 (최신 함수 사용)
    const decipher = crypto.createDecipheriv('aes-256-cbc', finalKey, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('API 키 복호화 실패:', error);
    throw new Error('API 키 복호화에 실패했습니다');
  }
}

// 암호화된 API 키가 유효한지 검증 (복호화 가능 여부만 확인)
export function validateEncryptedApiKey(encryptedKey: string, salt: string, userId: string): boolean {
  try {
    decryptApiKey(encryptedKey, salt, userId);
    return true;
  } catch {
    return false;
  }
}
