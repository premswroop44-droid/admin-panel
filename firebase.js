import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5cNG2qrw1FHQQeLsyR-JEbfKVoBiCscY",
  authDomain: "niyam-app-fe2bc.firebaseapp.com",
  projectId: "niyam-app-fe2bc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getCurrentCycleKeyValue() {
  const now = new Date();
  const cycleStart = new Date(now);
  cycleStart.setHours(3, 0, 0, 0);

  if (now < cycleStart) {
    cycleStart.setDate(cycleStart.getDate() - 1);
  }

  return cycleStart.toISOString();
}

function getEffectiveScore(data) {
  return data?.scoreCycleKey === getCurrentCycleKeyValue() ? Number(data.score || 0) : 0;
}

async function findUserRecord(name, studentClass, phone) {
  const q = query(
    collection(db, "users"),
    where("name", "==", name),
    where("class", "==", studentClass),
    where("phone", "==", phone)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() };
}

async function findUserByPhone(phone) {
  const q = query(collection(db, "users"), where("phone", "==", phone));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() };
}

async function findPinRecord(phone) {
  const q = query(collection(db, "pins"), where("phone", "==", phone));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() };
}

async function saveUserToFirebase() {
  const name = document.getElementById("name")?.value?.trim();
  const studentClass = document.getElementById("class")?.value?.trim();
  const age = document.getElementById("age")?.value?.trim();
  const gender = document.getElementById("gender")?.value?.trim();
  const phone = document.getElementById("phone")?.value?.trim();

  if (!name || !studentClass || !age || !gender || !phone) {
    alert("Sab fields fill karo");
    return;
  }

  const existingUser = await findUserRecord(name, studentClass, phone);
  if (existingUser) {
    alert("Yeh baccha pehle se register hai");
    return;
  }

  const createdRef = await addDoc(collection(db, "users"), {
    name,
    class: studentClass,
    age,
    gender,
    phone,
    score: 0,
    scoreCycleKey: getCurrentCycleKeyValue(),
    created: new Date()
  });

  localStorage.setItem("childName", name);
  localStorage.setItem("childPhone", phone);
  localStorage.setItem("childClass", studentClass);
  localStorage.setItem("childUserId", createdRef.id);
  localStorage.setItem("childScore", "0");
  localStorage.setItem("scoreCycleKey", getCurrentCycleKeyValue());

  alert("Registration Successful");
  window.location.href = "dashboard.html";
}

async function loginUser() {
  const name = document.getElementById("loginName")?.value?.trim();
  const studentClass = document.getElementById("loginClass")?.value?.trim();
  const phone = document.getElementById("loginPhone")?.value?.trim();

  if (!name || !studentClass || !phone) {
    alert("Login details fill karo");
    return;
  }

  const existingUser = await findUserRecord(name, studentClass, phone);
  if (!existingUser) {
    alert("Galat jankari");
    return;
  }

  localStorage.setItem("childName", existingUser.name || name);
  localStorage.setItem("childPhone", existingUser.phone || phone);
  localStorage.setItem("childClass", existingUser.class || studentClass);
  localStorage.setItem("childUserId", existingUser.id);
  localStorage.setItem("childScore", String(getEffectiveScore(existingUser)));
  localStorage.setItem("scoreCycleKey", getCurrentCycleKeyValue());

  alert("Login Successful");
  window.location.href = "dashboard.html";
}

async function saveParentPin(phone, pin) {
  const existingPin = await findPinRecord(phone);
  if (existingPin) {
    await updateDoc(doc(db, "pins", existingPin.id), { pin });
    return existingPin.id;
  }

  const createdRef = await addDoc(collection(db, "pins"), {
    phone,
    pin,
    created: new Date()
  });
  return createdRef.id;
}

async function getParentPin(phone) {
  const record = await findPinRecord(phone);
  return record ? record.pin : null;
}

async function updateUserScore(userId, score, extras = {}) {
  if (!userId) {
    return;
  }
  await updateDoc(doc(db, "users", userId), { score, ...extras });
}

function subscribeLeaderboard(callback) {
  return onSnapshot(collection(db, "users"), (snapshot) => {
    const users = [];
    snapshot.forEach((docu) => {
      const data = docu.data();
      const effectiveScore = getEffectiveScore(data);
      if (effectiveScore <= 0) {
        return;
      }
      users.push({
        id: docu.id,
        ...data,
        score: effectiveScore
      });
    });
    users.sort((a, b) => (b.score || 0) - (a.score || 0));
    callback(users);
  });
}

async function changePin() {
  const phone = document.getElementById("childPhone")?.value?.trim();
  const newPin = document.getElementById("newPin")?.value?.trim();

  if (!phone || !newPin) {
    alert("Phone aur PIN dono bharo");
    return;
  }

  const existingPin = await findPinRecord(phone);
  if (!existingPin) {
    alert("Phone number ka PIN record nahi mila");
    return;
  }

  await updateDoc(doc(db, "pins", existingPin.id), { pin: newPin });
  alert("PIN Updated");
}

async function loadPins() {
  const pinsList = document.getElementById("pinsList");
  if (!pinsList) {
    return;
  }

  const snapshot = await getDocs(collection(db, "pins"));
  if (snapshot.empty) {
    pinsList.innerHTML = "<p>Abhi koi PIN save nahi hua.</p>";
    return;
  }

  pinsList.innerHTML = "";
  for (const docu of snapshot.docs) {
    const data = docu.data();
    const linkedUser = data.phone ? await findUserByPhone(data.phone) : null;
    pinsList.innerHTML += `
      <div class="pin-row">
        <div>
          <b>${linkedUser?.name || "Naam nahi mila"}</b><br>
          <span>Class: ${linkedUser?.class || "-"} | Phone: ${data.phone || "-"}</span>
        </div>
        <input type="text" id="pin-edit-${docu.id}" value="${data.pin || ""}" maxlength="4">
        <button class="btn btn-edit" onclick="updatePinRow('${docu.id}')">Save PIN</button>
      </div>
    `;
  }
}

async function updatePinRow(docId) {
  const input = document.getElementById(`pin-edit-${docId}`);
  const newPin = input?.value?.trim();
  if (!newPin || newPin.length !== 4) {
    alert("4 digit PIN dalo");
    return;
  }

  await updateDoc(doc(db, "pins", docId), { pin: newPin });
  alert("PIN updated");
}

async function loadUsers() {
  const table = document.getElementById("usersTable");
  if (!table) {
    return;
  }

  table.innerHTML = `
    <tr>
      <th>Naam</th>
      <th>Class</th>
      <th>Phone</th>
      <th>Score</th>
    </tr>
  `;

  const snapshot = await getDocs(collection(db, "users"));
  snapshot.forEach((docu) => {
    const data = docu.data();
    table.innerHTML += `
      <tr>
        <td>${data.name || ""}</td>
        <td>${data.class || ""}</td>
        <td>${data.phone || ""}</td>
        <td>${getEffectiveScore(data)}</td>
      </tr>
    `;
  });
}

async function loadChildrenOptions() {
  const select = document.getElementById("groupChildren");
  if (!select) {
    return;
  }

  select.innerHTML = "";
  const [usersSnapshot, groupsSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "admin_groups"))
  ]);

  const assignedChildren = new Set();
  groupsSnapshot.forEach((docu) => {
    const data = docu.data();
    (data.children || []).forEach((child) => {
      const key = child.phone || `${child.name || ""}::${child.class || ""}`;
      assignedChildren.add(key);
    });
  });

  let hasUnassignedChild = false;

  usersSnapshot.forEach((docu) => {
    const data = docu.data();
    const key = data.phone || `${data.name || ""}::${data.class || ""}`;

    if (assignedChildren.has(key)) {
      return;
    }

    hasUnassignedChild = true;
    const option = document.createElement("option");
    option.value = JSON.stringify({
      name: data.name || "",
      class: data.class || "",
      phone: data.phone || ""
    });
    option.textContent = `${data.name || "Baccha"} - Class ${data.class || "-"}`;
    select.appendChild(option);
  });

  if (hasUnassignedChild) {
    return;
  }

  const option = document.createElement("option");
  option.disabled = true;
  option.textContent = "Sab bacche kisi na kisi admin ko assign ho chuke hain";
  select.appendChild(option);
}

async function saveAdminGroup() {
  const adminName = document.getElementById("groupAdminName")?.value?.trim();
  const adminPhone = document.getElementById("groupAdminPhone")?.value?.trim();
  const meetLink = document.getElementById("groupMeetLink")?.value?.trim();
  const select = document.getElementById("groupChildren");

  if (!adminName || !adminPhone || !select) {
    alert("Admin name, phone aur bacche select karo");
    return;
  }

  const children = Array.from(select.selectedOptions).map((option) => JSON.parse(option.value));
  if (!children.length) {
    alert("Kam se kam ek baccha select karo");
    return;
  }

  await addDoc(collection(db, "admin_groups"), {
    adminName,
    adminPhone,
    meetLink,
    children,
    created: new Date()
  });

  alert("Admin group save ho gaya");
  document.getElementById("groupAdminName").value = "";
  document.getElementById("groupAdminPhone").value = "";
  document.getElementById("groupMeetLink").value = "";
  Array.from(select.options).forEach((option) => {
    option.selected = false;
  });
  await loadAdminGroups();
  await loadChildrenOptions();
}

async function loadAdminGroups() {
  const div = document.getElementById("adminGroupsList");
  if (!div) {
    return;
  }

  div.innerHTML = "";
  const snapshot = await getDocs(collection(db, "admin_groups"));

  if (snapshot.empty) {
    div.innerHTML = "<p>Abhi koi admin group nahi bana.</p>";
    return;
  }

  snapshot.forEach((docu) => {
    const data = docu.data();
    const childrenText = (data.children || [])
      .map((child) => `${child.name} (Class ${child.class || "-"})`)
      .join(", ");

    div.innerHTML += `
      <p>
        <b>${data.adminName || "Admin"}</b> (${data.adminPhone || "No phone"})<br>
        ${data.meetLink ? `<span>Meet: <a href="${data.meetLink}" target="_blank">${data.meetLink}</a></span><br>` : ""}
        <span>Bacche: ${childrenText}</span>
        <button class="btn btn-edit" style="margin-left:10px;" onclick="deleteAdminGroup('${docu.id}')">Delete</button>
      </p>
    `;
  });
}

async function deleteAdminGroup(groupId) {
  await deleteDoc(doc(db, "admin_groups", groupId));
  alert("Admin group delete ho gaya");
  await loadAdminGroups();
  await loadChildrenOptions();
}

async function findAssignedAdmin(name, studentClass, phone) {
  const snapshot = await getDocs(collection(db, "admin_groups"));
  let assignedAdmin = null;

  snapshot.forEach((docu) => {
    const data = docu.data();
    const found = (data.children || []).find(
      (child) =>
        child.name === name ||
        (phone && child.phone === phone) ||
        (studentClass && child.class === studentClass && child.name === name)
    );

    if (found && !assignedAdmin) {
      assignedAdmin = {
        adminName: data.adminName || null,
        adminPhone: data.adminPhone || "",
        meetLink: data.meetLink || ""
      };
    }
  });

  return assignedAdmin;
}

async function loadLeaderboard() {
  const table = document.getElementById("leaderboard");
  if (!table) {
    return;
  }

  table.innerHTML = `
    <tr>
      <th>Rank</th>
      <th>Name</th>
      <th>Score</th>
    </tr>
  `;

  const snapshot = await getDocs(collection(db, "users"));
  const users = [];
  snapshot.forEach((docu) => {
    const data = docu.data();
    const effectiveScore = getEffectiveScore(data);
    if (effectiveScore <= 0) {
      return;
    }
    users.push({ ...data, score: effectiveScore });
  });
  users.sort((a, b) => (b.score || 0) - (a.score || 0));

  users.forEach((user, index) => {
    table.innerHTML += `
      <tr>
        <td>${index + 1}</td>
        <td>${user.name || ""}</td>
        <td>${user.score || 0}</td>
      </tr>
    `;
  });
}

async function loadActivity() {
  const div = document.getElementById("activityList");
  if (!div) {
    return;
  }

  div.innerHTML = "";
  const snapshot = await getDocs(collection(db, "activities"));
  let hasRejected = false;

  snapshot.forEach((docu) => {
    const d = docu.data();
    if (d.status !== "reject") {
      return;
    }

    hasRejected = true;
    div.innerHTML += `
      <p><b>${d.name || "Baccha"}</b> ne <b>${d.task || "Task"}</b> me jhooth bola.</p>
    `;
  });

  if (!hasRejected) {
    div.innerHTML = "<p>Abhi kisi ne jhooth nahi bola.</p>";
  }
}

async function loadDailySummary() {
  const div = document.getElementById("dailySummaryList");
  if (!div) {
    return;
  }

  div.innerHTML = "";
  const [usersSnapshot, activitiesSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "activities"))
  ]);

  const users = [];
  usersSnapshot.forEach((docu) => users.push(docu.data()));

  const today = new Date().toDateString();
  const dailyCount = new Map();

  activitiesSnapshot.forEach((docu) => {
    const item = docu.data();
    const timeValue = item.time?.toDate ? item.time.toDate() : new Date(item.time);
    if (timeValue.toDateString() !== today) {
      return;
    }

    const key = item.name || "Baccha";
    dailyCount.set(key, (dailyCount.get(key) || 0) + 1);
  });

  let hasSummary = false;

  users.forEach((user) => {
    const name = user.name || "Baccha";
    const count = dailyCount.get(name) || 0;

    if (count === 0) {
      hasSummary = true;
      div.innerHTML += `<p><b>${name}</b> (Class ${user.class || "-"}) ne aaj app nahi khola ya koi task complete nahi kiya.</p>`;
      return;
    }

    if (count <= 2) {
      hasSummary = true;
      div.innerHTML += `<p><b>${name}</b> (Class ${user.class || "-"}) ne aaj sirf ${count} task kiya aur phir ruk gaya.</p>`;
    }
  });

  if (!hasSummary) {
    div.innerHTML = "<p>Aaj sab bacche active dikh rahe hain.</p>";
  }
}

async function addChallenge() {
  const title = document.getElementById("challengeTitle")?.value?.trim();
  const pointsValue = document.getElementById("challengePoints")?.value?.trim();
  if (!title || !pointsValue) {
    alert("Fill all fields");
    return;
  }

  await addDoc(collection(db, "challenges"), {
    title,
    points: Number(pointsValue),
    active: true,
    created: new Date()
  });

  alert("Challenge Added");
}

async function initAdminPage() {
  await Promise.all([loadUsers(), loadLeaderboard(), loadActivity(), loadDailySummary()]);
}

window.saveUserToFirebase = saveUserToFirebase;
window.loginUser = loginUser;
window.changePin = changePin;
window.addChallenge = addChallenge;
window.updatePinRow = updatePinRow;
window.deleteAdminGroup = deleteAdminGroup;

export {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  saveUserToFirebase,
  loginUser,
  changePin,
  loadUsers,
  loadChildrenOptions,
  saveAdminGroup,
  loadAdminGroups,
  deleteAdminGroup,
  findAssignedAdmin,
  loadLeaderboard,
  loadActivity,
  loadDailySummary,
  loadPins,
  addChallenge,
  initAdminPage,
  findUserRecord,
  findUserByPhone,
  saveParentPin,
  getParentPin,
  updateUserScore,
  subscribeLeaderboard,
  updatePinRow
};
