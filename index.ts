import * as functions from 'firebase-functions'
import * as algoliasearch from 'algoliasearch'
import * as admin from 'firebase-admin'

admin.initializeApp();

const client = algoliasearch("MYEGE624YZ", "e005d6f0167f0bec4eb7917c186be4c6")
const adultsIndex = client.initIndex(`dev_USERNAME`) // <-- Index name

  export const algoliaAdultsSync = functions
  .firestore.document(`Users/{user_id}`).onWrite(async (change, _context) => {
    const oldData = change.before
    const newData = change.after
    const data = newData.data()
    const objectID = newData.id // <-- prop name is important

    if (!oldData.exists && newData.exists) {
        // creating
        return adultsIndex.addObject(Object.assign({}, {
          objectID
        }, data))
      } else if (!newData.exists && oldData.exists) {
        // deleting
        return adultsIndex.deleteObject(objectID)
      } else  {
        // updating
        return adultsIndex.saveObject(Object.assign({}, {
          objectID
        }, data))
    }
})

export interface MessagesNoti {
  recipientId: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  type: string;
}

export const notifyNewMessage = functions.firestore
.document('chatsChannels/{channel}/messages/{message}')
    .onCreate((doc, context) => {

        const data = doc.data() as MessagesNoti;


        let recipientId = data['recipientId'];
        let senderId = data['senderId'];
        let senderName = data['senderName'];
        let type = data['type'];
        let text = data['text'];

        return admin.firestore().doc('Users/'+recipientId).get().then(userDoc => {
            const registrationTokens = userDoc.get('registrationTokens')
            console.log("reg: ",registrationTokens);

            const notificationBody = (type === "TEXT") ? text : "You received a new image message"
            const payload = {
                notification: {
                    title: senderName + " sent you a message.",
                    body: notificationBody,
                    clickAction: "ChatActivity"
                },
                data: {
                    USER_NAME: senderName,
                    USER_ID: senderId
                }
            }

            return admin.messaging().sendToDevice(registrationTokens, payload).then(response => {

				const stillRegisteredTokens = registrationTokens

                response.results.forEach((result, index) => {
                    const error = result.error
                    if (error) {
                        const failedRegistrationToken = registrationTokens[index]
						console.error('blah', failedRegistrationToken, error)
						if (error.code === 'messaging/invalid-registration-token'
						|| error.code === 'messaging/registration-token-not-registered'){
							const failedIndex = stillRegisteredTokens.indexOf(failedRegistrationToken)
							if (failedIndex > -1) {
								  stillRegisteredTokens.splice(failedIndex, 1)
							}
						}
			     }
		     })
				    return admin.firestore().doc("Users/" + recipientId).update({registrationTokens:stillRegisteredTokens})
	    })

  })
})
