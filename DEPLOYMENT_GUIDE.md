# 제주소금 웹앱 배포 가이드

Docker를 사용하여 제주소금 웹앱을 배포하는 완전한 가이드입니다.

## 📋 사전 준비사항

- Docker & Docker Compose 설치
- Git (원본 코드 버전 관리용)
- 배포 서버 (VPS, AWS EC2, DigitalOcean 등)
- SSH 접근 권한
- 도메인 (선택사항)

## 🚀 로컬 테스트

배포 전에 로컬에서 Docker 이미지를 테스트합니다:

```bash
# 프론트엔드 빌드 (Vite)
cd jejusalt-frontend
npm install
npm run build
cd ..

# Docker Compose로 전체 스택 실행
docker-compose up --build

# 브라우저에서 확인
# http://localhost:5176 (프론트엔드)
# http://localhost:5000 (백엔드 API)
```

## 📦 서버에 배포하기

### 1. 서버 준비

```bash
# SSH로 서버 접속
ssh user@your-server-ip

# Docker 설치 (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 사용자 그룹에 docker 권한 추가
sudo usermod -aG docker $USER
newgrp docker
```

### 2. 프로젝트 복제 및 설정

```bash
# 프로젝트 디렉토리 생성
mkdir -p /opt/jejusalt
cd /opt/jejusalt

# 깃에서 코드 클론 (또는 SCP로 파일 전송)
git clone <your-repo-url> .

# 환경 변수 설정
cat > .env << EOF
SUPABASE_URL=https://bwquipczxdmofkfmbvdd.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
TIMELY_AI_API_KEY=your_api_key_here
HIGGSFIELD_API_KEY=your_higgsfield_key_here
HIGGSFIELD_API_SECRET=your_secret_here
EOF

# 프론트엔드 빌드
cd jejusalt-frontend
npm install
npm run build
cd ..
```

### 3. Docker 컨테이너 실행

```bash
# 백그라운드에서 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 상태 확인
docker-compose ps
```

### 4. Nginx (리버스 프록시) 설정 (선택사항)

도메인을 통해 접근하려면 호스트 머신의 Nginx를 설정합니다:

```bash
# /etc/nginx/sites-available/jejusalt
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5176;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Nginx 활성화:
```bash
sudo ln -s /etc/nginx/sites-available/jejusalt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL 인증서 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt-get install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 활성화
sudo systemctl enable certbot.timer
```

## 📊 모니터링 및 관리

### 로그 확인
```bash
# 모든 서비스 로그
docker-compose logs -f

# 백엔드만
docker-compose logs -f backend

# 프론트엔드만
docker-compose logs -f frontend
```

### 컨테이너 재시작
```bash
# 모든 서비스 재시작
docker-compose restart

# 특정 서비스 재시작
docker-compose restart backend
```

### 데이터베이스 마이그레이션 실행
```bash
# 컨테이너 내부 쉘 접근
docker-compose exec backend sh

# 마이그레이션 실행 (필요시)
npm run migrate
```

## 🔄 업데이트 배포

코드 변경 후 업데이트:

```bash
cd /opt/jejusalt

# 최신 코드 가져오기
git pull origin main

# 프론트엔드 재빌드
cd jejusalt-frontend
npm install
npm run build
cd ..

# 컨테이너 재빌드 및 재시작
docker-compose up -d --build

# 상태 확인
docker-compose ps
```

## 🆘 트러블슈팅

### 포트 충돌
```bash
# 포트 사용 현황 확인
sudo lsof -i :5176  # 프론트엔드
sudo lsof -i :5000  # 백엔드

# 충돌 시 docker-compose.yml의 포트 변경
```

### 메모리 부족
```bash
# 컨테이너 리소스 확인
docker stats

# 불필요한 이미지 정리
docker image prune -a

# 불필요한 컨테이너 정리
docker container prune
```

### API 연결 실패
```bash
# 백엔드 로그 확인
docker-compose logs backend

# 환경변수 확인
docker-compose config | grep -i supabase
```

## 🔐 보안 체크리스트

- [ ] `.env` 파일이 `.gitignore`에 등록되어 있는지 확인
- [ ] 서버 방화벽에서 필요한 포트만 개방 (80, 443)
- [ ] SSH 키 기반 인증 사용 (비밀번호 인증 비활성화)
- [ ] 정기적인 보안 업데이트 수행
- [ ] 백업 계획 수립
- [ ] 에러 로그 모니터링

## 📞 지원

문제가 발생하면:

1. 로그 확인: `docker-compose logs -f`
2. 설정 검증: `docker-compose config`
3. 컨테이너 상태: `docker-compose ps`

## 🔗 참고자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 가이드](https://docs.docker.com/compose/)
- [Nginx 공식 문서](https://nginx.org/)
- [Supabase 문서](https://supabase.com/docs)
