# 파일명: sync_hourly.ps1
# 위치: C:\claude-workspace\sync_hourly.ps1

$projectPath = "C:\claude-workspace"
$startHour = 9
$endHour = 18

while ($true) {
    $now = Get-Date
    $currentHour = $now.Hour
    $currentMinute = $now.Minute
    
    # 09:00 ~ 18:00 사이 정각마다 실행
    if ($currentHour -ge $startHour -and $currentHour -le $endHour -and $currentMinute -eq 0) {
        Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - 동기화 시작" -ForegroundColor Green
        
        cd $projectPath
        
        # Pull
        git pull origin main
        
        # 변경사항 확인
        $status = git status --porcelain
        if ($status) {
            Write-Host "변경사항 감지, 커밋 및 푸시 중..." -ForegroundColor Yellow
            git add .
            git commit -m "AUTO: $(Get-Date -Format 'yyyy-MM-dd HH:mm') - 정시 동기화"
            git push origin main
            Write-Host "푸시 완료!" -ForegroundColor Green
        } else {
            Write-Host "변경사항 없음" -ForegroundColor Gray
        }
        
        # 다음 정각까지 대기 (60초 + 차이)
        Start-Sleep -Seconds 60
    } else {
        # 1분마다 체크
        Start-Sleep -Seconds 60
    }
}