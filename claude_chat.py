from anthropic import Anthropic

client = Anthropic()
conversation_history = []

print("Claude와 대화 중입니다. (quit 입력 시 종료)")
print("-" * 50)

while True:
    user_input = input("\n당신: ").strip()
    
    if user_input.lower() in ['quit', 'exit', 'q']:
        break
    
    if not user_input:
        continue
    
    conversation_history.append({"role": "user", "content": user_input})
    
    response = client.messages.create(
        model='claude-opus-4-1',
        max_tokens=1024,
        messages=conversation_history
    )
    
    assistant_message = response.content[0].text
    conversation_history.append({"role": "assistant", "content": assistant_message})
    
    print(f"\nClaude: {assistant_message}")
