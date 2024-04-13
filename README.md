# Architecture

# `mockCourses` 

These services holds the most up-to-date details about every course, as found it `courses.json`.

This is intended to emulate a database connection. Alternatively this can be viewed as mocking the C@B api, to prevent us from overwhelming it. It does not know about any indexing or anything.

There should only be one `mockCourses` node.

## `mockCourses/list[]`

lists the codes of all of the known courses

## `mockCourses/detail[subject, number]`

provides details about a single course. This is the corresponding value in `courses.json`.

# `mockStudents`

Holds the most up-to-date detail about every student from `students.json`.

There should only be one `mockStudents` node

## `mockStudents/list[]`

lists the codes of all of the students `studentTokens`.

## `mockStudents/detail[studentToken]`

provides details about a single student. 

# `client` 

This is what the users of the web interface talk to. Orchestrates requests on the behalf of clients.

There may be many client nodes to distribute load.

Requests made to these services should not be trusted, since these services will be exposed to the internet.

## `client/search[{subject, number, title, description, instructor}]` 

Set a parameter to null if you're not making any specific search in that category

## `client/listRegister[studentToken]`

Lists all the courses the student is registered for this term

## `client/addRegister[subject, number, studentToken]`

Attempts to register a student to a course. Can fail.

# `students`

Stores which courses each student is registered for. Also stores the students qualifications, which courses the student has taken in the past.

## `students/lock[studentToken] -> studentsLock`

Grabs a lock on registering a student for this course. May fail if they have already registered for 5 courses.

## `students/unlock[studentToken]`

Removes the lock, probably since the course endpoint cancelled. Cannot cancel if you already registered.

## `students/submit[studentsLock, studentToken]`

Submits the registration. Never fails if you submit the right token.

## `students/listRegister[studentToken]`

Lists all courses that the student is currently registered for

# `courses`

## `courses/lock[studentRecord, studentToken] -> coursesLock`

Attempts to lock this student registration. May fail if the student does not qualify for the course.

## `courses/submit[coursesLock, studentToken]`

Submits the registration. Never fails if you submit the right token.

## `courses/unlock[studentToken]`

Removes the registration lock, because one of the checks failed.

## `courses/search[{subject, number, title, description, instructor}]`

Searches for the course using the node's internal indexes

## `courses/listRegister[]`

Lists all students that are registerd for this course

# Operation

The `students` nodes make requests to the `mockStudents` node to gather all of the data. They save the student info in their local store. Each node is only responsible for the students that consistent hash to them. 

The `courses` nodes make requests to the `mockClients` node to gather all of the data. They save the course info in their local store. They then do indexing so that searches are fast. Each node is only responsible for the courses that consistent hash to them. 

Once this setup phase is complete, each node sends all other nodes a "ready" message.

The client waits for all the ready messages before it processes any requests

When a user tells the client node that they want to register for a course, the client attempts to get a lock on the `courses` and get a lock with the `students` endpoint. Then, if and only if it obtains both, it will make `submit` requests to the courses and students endpoint, and reports back whether the request successful 

When a user tells the client node to search, the client sends the search request to all of the `courses` nodes. The client then aggregates the responses.

The results of the registration go in persistent storage.

# Assumptions / Invariants

We are imagining a setting where all of the course data and student data are frozen, and students are searching for and registering for courses. Several unrealistic simplifying assumptions are made. These should be assumed, checked, and verified as makes sense.

Students may register for a course if and only if they are qualified for it.

The qualifications are the prerequisite qualifications and semester level qualifications (and no others).

The courses do not have an enrollment limit.

Students may not register for more than 5 courses.

If a student manages to register for a course, they do not become deregistered.

A student's qualifications do not change.

A course's prerequisites do not change.

The nodes do not go down.

The nodes have knowldege of all of the other nodes IPs at startup.

There is no separate student secret; students are identiifed by their studentToken

Once a student registers for a course, that course will appear in their listing, and the student will appear in the course's listing.

All courses are offered this term (only), and there is exactly one section for each.

```
jq -s '[. | .[] | {(.code.subject + " " +  .code.number): .}] | sort | add' minimized.jsonl > courses.json
```

```
jq -s '[. | .[] | {(.code.subject + " " +  .code.number): ({subject: .code.subject, number: .code.number} + (. | del(.code)) )}] | sort | add' minimized.jsonl
```

`https://github.com/aruljohn/popular-baby-names/blob/master/2000/girl_boy_names_2000.csv`
