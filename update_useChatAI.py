with open("hooks/useChatAI.ts", "r", encoding="utf8") as f:
    content = f.read()

target = "aiContent = ChatParser.cleanAiSecondPass(aiContent);"
replacement = """aiContent = ChatParser.cleanAiSecondPass(aiContent);

            // Execute any parsed actions BEFORE side effect handlers like Search/Recall
            aiContent = await ChatParser.parseAndExecuteActions(aiContent, char.id, char.name, addToast);"""

content = content.replace(target, replacement)

with open("hooks/useChatAI.ts", "w", encoding="utf8") as f:
    f.write(content)

print("success")
