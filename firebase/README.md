# Everest Scholars portal

The login-only portal lives at **www.everestscholars.org/portal**. The pages are plain files in `portal/` (served by GitHub Pages like the rest of the site). Logins and data are in Firebase: Authentication for sign-in, Firestore for everything else.

## Who sees what

| Role | Sees | Can change |
|---|---|---|
| **Student** | Their own dashboard, sessions, tasks, roadmap, drafts, questions, college list, calendar. Resources once enrolled. | Tick off tasks, add their own tasks, submit drafts, ask questions, manage their college list, move milestone status. |
| **Mentor** | Only the students assigned to them, including internal check-ins. Resources. | Log sessions, assign tasks, set milestones, check in, reply to drafts and questions, set goals and the student folder link. |
| **Founder** (admin) | Everyone. | Everything above, plus adding people, assigning mentors, marking enrollment, managing resources. |

These rules are enforced by the database itself (`firestore.rules`), not just hidden in the page. A student who edits the page code still cannot read another student's data. `tests/rules.test.mjs` checks this.

## Adding someone

1. A founder opens **People** and clicks **Add a person**.
2. They enter the person's name, the exact email they will sign in with, and their role. Students also get a mentor, paths and enrollment.
3. That person goes to everestscholars.org/portal and either clicks **Continue with Google** or chooses **First time? Set up your password**. Password sign-ups confirm their email first.

Anyone who signs in with an email that is not on the People list sees "No portal access yet" and nothing else.

## Student folder

Each student has a Google Drive folder named **"Student Name - Everest Scholars"**. The **Student folder** button opens the link saved on their profile. If no link is saved yet, it searches Drive for that exact folder name. A founder can paste the link on the People page, or click **Create Drive folder** (once a Google OAuth client ID is set in `portal/js/config.js`). That creates the folder in their Drive and shares it with the student, their parent and their mentor.

## Resources

Resources are links to files in Google Drive, grouped into four folders: research competitions, summer programs, college applications, and guides and templates. Only enrolled students and staff can see the list. The files themselves follow Drive's sharing. Share the Drive folder that holds them with enrolled students (view only). Don't use "anyone with the link".

## Data

```
members/{email}                 one profile per person (lowercase email)
members/{email}/sessions        meetings, with notes the student can read
members/{email}/tasks           to-dos; done is ticked by the student or mentor
members/{email}/milestones      the roadmap ("Your climb")
members/{email}/requests        draft reviews and questions, with replies
members/{email}/colleges        the college list
members/{email}/checkins        internal mentor notes (students cannot read these)
resources/{id}                  the library
```

## Working on it locally

You need Node 20+ and Java 21 (`brew install openjdk@21`). Then:

```bash
cd firebase
npm install
npm run dev     # starts local Firebase, loads sample data, serves the site
```

Open http://localhost:5050/portal/?demo and sign in as the sample founder, mentor or student. Nothing local touches the real database. `npm test` runs the security rules tests.

## Deploying rule changes

Page changes go live when they are pushed to `main`. Changes to `firestore.rules` need one extra step from someone with access to the Firebase project:

```bash
cd firebase
npm test                                   # must pass
npx firebase deploy --only firestore:rules
```
