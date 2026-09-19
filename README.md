# team-introductions — DWNC 10기 2팀 GitHub 협업 실습

팀원 각자 자기소개 파일을 **브랜치 → PR**로 올리고, 팀장이 merge하는 연습입니다.
아래를 위에서부터 그대로 따라 하면 됩니다. (터미널: ChatGPT/Codex 앱에서 `Ctrl+`` ` 또는 Mac 터미널)

## 0. 준비 (처음 한 번만)

```bash
git --version          # 버전 나오면 OK. 안 나오면 git 설치
gh --version           # 안 나오면 Mac: brew install gh / Windows: winget install GitHub.cli
gh auth login --web --git-protocol https   # 브라우저 열리면 로그인 + Authorize
gh auth status         # ✓ Logged in ... 나오면 OK
git config --global user.name "본인이름"
git config --global user.email "깃허브가입이메일"
```

## 1. 초대 수락

GitHub 알림(종 아이콘) 또는 메일에서 **Accept invitation**. 안 보이면 👉 https://github.com/pwskym1234/team-introductions/invitations

## 2. 저장소 받아오기 + 내 브랜치 만들기

```bash
cd ~/Desktop                                  # 원하는 폴더로 이동
gh repo clone pwskym1234/team-introductions
cd team-introductions
git switch -c intro/본인깃허브아이디            # 예: git switch -c intro/hwnpark
git branch --show-current                     # intro/본인아이디 나오면 OK
```

## 3. 자기소개 파일 만들기

`introductions/본인깃허브아이디.md` 파일을 만들고 아래처럼 작성 (ChatGPT한테 시켜도 됨):

```markdown
# 안녕하세요, hwnpark입니다!
- 이름: 홍길동
- 관심 분야: ...
- 사용해 본 기술: ...
- 해커톤에서 해보고 싶은 역할: ...
- 한마디: 화이팅!
```

## 4. 커밋 + 푸시 + PR

```bash
git status                                    # Untracked: introductions/본인아이디.md 보이면 OK
git add introductions/본인아이디.md
git commit -m "docs: 홍길동 자기소개 추가"
git push -u origin intro/본인아이디
gh pr create --web                            # 브라우저 열림 → 제목 확인 → Create pull request
```

PR 생성되면 끝! 팀장이 확인 후 merge합니다.

## 5. (merge 된 후) 최신 내용 받기

```bash
git switch main
git pull origin main
ls introductions                              # 팀원들 파일 보이면 성공
git branch -d intro/본인아이디                 # 필요 없어진 브랜치 삭제
```

## 🆘 막힐 때

| 증상 | 해결 |
|---|---|
| `gh: command not found` | gh 설치 (0번) |
| push 할 때 인증 실패 | `gh auth login --web --git-protocol https` 다시 |
| `Please tell me who you are` | `git config --global user.name/email` 설정 (0번) |
| `permission denied` / 403 | 초대 수락했는지 확인 (1번) |
| `gh pr create --web` 이 안 열림 | GitHub 저장소 페이지 새로고침 → 노란 띠 **Compare & pull request** 클릭 |
