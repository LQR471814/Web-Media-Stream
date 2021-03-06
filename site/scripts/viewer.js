var viewerID = Math.floor(Math.random() * Date.now());
var peerID;
var peerConnection = new RTCPeerConnection();
var pendingICE = [];
var remoteIsReady = false;
var peerStream = new MediaStream();

peerConnection.oniceconnectionstatechange = async (e) => {
  console.log(`ICE State Change: ${e.target.iceConnectionState}`);
};
peerConnection.onicecandidate = (e) => {
  if (e.candidate !== null) {
    signalingChannel.send(
      JSON.stringify({
        MsgType: "ice",
        To: peerID,
        ID: viewerID,
        ICE: e.candidate,
      })
    );
  }
};
peerConnection.ontrack = (e) => {
  peerStream.addTrack(e.track);
  console.log("Got track:", e.track);

  try {
    document.body.removeChild(document.getElementById("ClientList"));
  } catch {}

  document.getElementById("video_preview").srcObject = peerStream;
};

var signalingChannel = new WebSocket(
  `wss://${window.location.host}/viewerSocket`
);
signalingChannel.onopen = (e) => {
  signalingChannel.send(
    JSON.stringify({ MsgType: "register_viewer", ID: viewerID })
  );
};
signalingChannel.onmessage = async (e) => {
  var message = JSON.parse(e.data);
  console.log(message);
  if (message.MsgType === "client_connections") {
    connections = JSON.parse(message.ClientConnections);
    try {
      while (document.getElementById("ClientList").firstChild) {
        document
          .getElementById("ClientList")
          .removeChild(document.getElementById("ClientList").firstChild);
      }
    } catch {}
    for (var client in connections) {
      var clientElement = document.createElement("li");
      var clientButton = document.createElement("button");
      clientButton.id = connections[client].ID;
      clientButton.innerText = connections[client].Name;
      clientButton.onclick = (e) => {
        document.getElementById("SiteTitle").innerText = e.target.innerText;
        peerID = parseInt(e.target.id);
        signalingChannel.send(
          JSON.stringify({
            MsgType: "request_offer",
            To: parseInt(e.target.id),
            ID: viewerID,
          })
        );
      };
      clientElement.append(clientButton);
      document.getElementById("ClientList").append(clientElement);
    }
  } else if (message.MsgType === "offer") {
    await peerConnection.setRemoteDescription(message.SDP);
    console.log("Set remote description success");

    var answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log("Set local description success");

    signalingChannel.send(
      JSON.stringify({
        MsgType: "answer",
        To: message.ID,
        ID: viewerID,
        SDP: answer,
      })
    );

    for (i in pendingICE) {
      await peerConnection.addIceCandidate(pendingICE[i]);
    }

    pendingICE = [];
    remoteIsReady = true;
  } else if (message.MsgType === "ice") {
    if (remoteIsReady) {
      await peerConnection.addIceCandidate(message.ICE);
    } else {
      pendingICE.push(message.ICE);
    }
  }
};
window.onbeforeunload = (e) => {
  peerConnection.close();
  signalingChannel.send(
    JSON.stringify({ MsgType: "unregister_viewer", ID: viewerID })
  );
};
