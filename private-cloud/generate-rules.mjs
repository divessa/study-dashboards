import { writeFileSync } from 'node:fs';
const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw Error('Provide the exact Firebase Authentication UID as an argument.');
const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() { return request.auth != null && request.auth.uid == '${uid}'; }
    match /users/{userId}/dashboards/{dashboard} {
      allow read, create, update: if isOwner() && userId == '${uid}' && dashboard in ['ects', 'campus'];
      allow delete: if false;
      match /legacy/{entry} {
        allow read, create: if isOwner() && userId == '${uid}' && dashboard in ['ects', 'campus'];
        allow update, delete: if false;
      }
      match /history/{revision} {
        allow read, create: if isOwner() && userId == '${uid}' && dashboard in ['ects', 'campus'];
        allow update, delete: if false;
      }
    }
    match /{document=**} { allow read, write: if false; }
  }
}`;
writeFileSync('private-cloud/generated.rules', rules, { flag: 'wx' });
console.log('Generated local rules; review and test before deployment.');
