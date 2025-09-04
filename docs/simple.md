# Simplified Explanation

- All TalkJS instances need to be swapped with Twilio Conversation.
- Logic of who is inside the conversations slightly changed
- Message handling from our Make.com webhooks and towards our Make.com webhooks

# Current Test Dashboard Stack

The front-end is using React + Vite.

The back-end is using Node.JS, Express.

# What needs to happen and what the process is like

1. Traveler comes in through the website, he gets put through Make.com for various checks, variable updates, CRM updates etc.
2. They get into the qualification step. It's our AI, but on their preferred contact method (WhatsApp / SMS / Email).
3. After qualification, we send the data to another Make.com workflow.
- here we analyze more of the details, we pick 3 possible vendors, we create the inquiry and contact etc.
- here the conversation is created inside the dashboard via a Make.com HTTP Request "https://conversations.twilio.com/v1/Services/[Conversation_Service_SID]/ConversationWithParticipants" 
- This is the request content currently in use for the test dashboard
    - Value:  application/x-www-form-urlencoded
    - Request Content: FriendlyName=[Traveler_Name_Separated_with_+_symbol_instead_of_space - like Albert+Tester]+-+[local_expert_name - like David+Test]&UniqueName=[the unique name - similar to an ID like inquiry_{{now}}]&Participant=%7B%22identity%22%3A%22david04032006%40gmail.com%22%7D&Participant=%7B%22identity%22%3A%22support_bot_17855040062%22%7D&Participant=%7B%22identity%22%3A%22tekami.albert%40gmail.com%22%7D&messagingServiceSid=MG480035c25d06be7e44bf33e65e4e0878
        - the emails here / identities represent the accounts added. 
        - in this example david... is the local expert, tekami... is the admin and the support_bot is the middle-man bot itself

- here we also create a conversation between admin and traveler
    - similar URL, similar value and request content
    - request content used in our test: FriendlyName={{replace(151.data.data[].Full_Name; space; "+")}}+-+David+Stancu&UniqueName=DM_{{now}}&Participant=%7B%22identity%22%3A%22support_bot_17855040062%22%7D&Participant=%7B%22identity%22%3A%22tekami.albert%40gmail.com%22%7D&messagingServiceSid=MG480035c25d06be7e44bf33e65e4e0878&Attributes={{encodeURL("{""typeOfChat"":""adminAndTraveler"", ""travelerPhone"":""" + 1.phone + """, ""travelerEmail"":""" + 1.email + """}")}}
        - we are defining attributes directly to these chats - this way the code inside the dashboard knows exactly that this Conversation(SID) is that between an admin and traveler, and when received in Make.com, we receive the message and the details to whom the Admin is sending a message.
4. Messages are sent back and forth. Ideally messages from the dashboard we send directly towards Make.com - alternative would be to send to twilio and then to make.com, but it's more complex to determine there what conversation is and for who + we also reach rate-limits for the twilio account for webhook calls.
5. Messages sent by traveler / bot are appended using this:
    - 
    - Here we are using attributes per message, which state if the message is from the traveler or the bot. The support_bot account sends both messages from AI and traveler, the difference is that inside the dashboard we detect with the code the attribute "from" and we display a badge or different color for messages sent by bot and those by traveler

## What is extra that is not inside this dashboard
- the logic of the local expert having to accept the inquiry before seeing the chat (potentially could make it where they exist inside the chat, but as "state = pending" or something... and only to see the chat if they have "state = accepted")
- showcase of inquiries etc.

