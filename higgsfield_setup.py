from higgsfield import HiggsField

# API 키로 연동
hf = HiggsField(
    api_key="75cfedac-c6b0-4424-a15c-65e7131fc28b",
    api_secret="1a62caf0585f21ed773814de3e9cae31c2cf53fc3dc5633af53538cb4efd5f45"
)

# 프로젝트 생성
project = hf.create_project(name="jejusalt")

print(f"프로젝트 생성: {project}")