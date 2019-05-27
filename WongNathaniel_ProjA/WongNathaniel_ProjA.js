// ORIGINAL SOURCE:
// RotatingTranslatedTriangle.js (c) 2012 matsuda
// HIGHLY MODIFIED to make:
//
// ADAPTED FROM
// BouncyBall.js  for EECS 351-1,
//									Northwestern Univ. Jack Tumblin
// -----------------------
// WongNathaniel_ProjA.js for EECS 351-2,
//									Northwestern Univ. Nathaniel Wong

//==============================================================================
// Vertex shader program:
var VSHADER_SOURCE =
  'precision mediump float;\n' +				// req'd in OpenGL ES if we use 'float'
  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjMatrix;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute float a_PointSize; \n' +
  'attribute vec4 a_Color; \n' +					// particle system state:
  'varying   vec4 v_Color; \n' +
  'void main() {\n' +
  '  gl_PointSize = a_PointSize;\n' +            // TRY MAKING THIS LARGER...
  '	 gl_Position = u_ModelMatrix * u_ProjMatrix * u_ViewMatrix * a_Position; \n' +
	'	 v_Color = a_Color;	\n' +		// red: 0==reset
  '} \n';

//==============================================================================
// Fragment shader program:
var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'uniform int u_sysType;\n' +
  'varying vec4 v_Color; \n' +
  'void main() {\n' +
  '  if (u_sysType == 11) { \n' +
  '    gl_FragColor = v_Color; \n' +
  '    return; \n' +
  '  } \n' +
  '  float dist = distance(gl_PointCoord, vec2(0.5, 0.5)); \n' +
  '  if(dist < 0.5) { \n' +
	'  	gl_FragColor = vec4((1.0-2.0*dist)*v_Color.rgb, 1.0);\n' +
	'  } else { discard; }\n' +
  '}\n';

// Global Variables
// =========================

var gl;   // webGL Rendering Context.  Created in main(), used everywhere.
var g_canvas; // our HTML-5 canvas object that uses 'gl' for drawing.
var u_sysType;

// For keyboard, mouse-click-and-drag: -----------------
var isDrag=false;		// mouse-drag: true when user holds down mouse button
var xMclik=0.0;			// last mouse button-down position (in CVV coords)
var yMclik=0.0;
var xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;

//--Animation---------------
var isClear = 1;		  // 0 or 1 to enable or disable screen-clearing in the draw()
var g_last = Date.now();				//  Timestamp: set after each frame of animation.
var g_stepCount = 0;						// Advances by 1 for each timestep, modulo 1000,
var g_timeStep    = 1000.0/60.0;  // current timestep (1/60th sec) in milliseconds
var g_timeStepMin = g_timeStep;   // min,max timestep values since last keypress.
var g_timeStepMax = g_timeStep;

// camera movement
var currentAngle = [-2.5,2.5];
var g_EyeX = 5.0, g_EyeY = 5.0, g_EyeZ = 5.0;
var g_LookX = g_EyeX + Math.cos(currentAngle[0]);
var g_LookY = g_EyeY + Math.cos(currentAngle[1]);
var g_LookZ = g_EyeZ + Math.sin(currentAngle[0]);
var vel = 0.1;
var ANGLE_STEP = 30.0;

// Create particle systems
var g_partA = new PartSys();
var g_partB = new PartSys();
var g_partC = new PartSys();
var g_partD = new PartSys();
var g_gndPlane = new PartSys();

function main() {
  g_canvas = document.getElementById('webgl');
	gl = g_canvas.getContext("webgl", { preserveDrawingBuffer: true});
  if (!gl) {
    console.log('main() Failed to get the rendering context for WebGL');
    return;
  }
	// First, register all mouse events found within our HTML-5 canvas:
  g_canvas.onmousedown	=	function(ev){myMouseDown(ev) };
  g_canvas.onmousemove = 	function(ev){myMouseMove(ev) };
  g_canvas.onmouseup = 		function(ev){myMouseUp(  ev) };

  // Next, register all keyboard events found within our HTML webpage window:
	window.addEventListener("keydown", myKeyPress, false);

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('main() Failed to intialize shaders.');
    return;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.35, 0.40, 0.35, 1);	 // RGBA color for clearing WebGL framebuffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);		// clear it once to set that color as bkgnd.

  // Get the graphics system storage locations of uniforms
  u_sysType = gl.getUniformLocation(gl.program, 'u_sysType');
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  var u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  var u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
  if (!u_ViewMatrix || !u_ProjMatrix || !u_ModelMatrix || !u_sysType) {
    console.log('Failed to get u_ModelMatrix u_ViewMatrix or u_ProjMatrix');
    return;
  }

  var viewMatrix = new Matrix4();
  var projMatrix = new Matrix4();
  var modelMatrix = new Matrix4();

  // Set the 'view' and 'proj' matrix:
  projMatrix.setPerspective(35, gl.drawingBufferWidth/gl.drawingBufferHeight, 0.1, 1000.1);
  gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);
  // Initialize Particle systems:
  g_gndPlane.init(SYS_GROUND_GRID, 100, 100);
  g_partA.init(SYS_SPRING_CLOTH, 15, 15);
  g_partB.init(SYS_TORNADO, 600);
  g_partC.init(SYS_FLOCKING, 90);
  g_partD.init(SYS_FIRE_REEVES, 600);

  var tick = function() {
    g_timeStep = animate();
    // find how much time passed (in milliseconds) since the
    // last call to 'animate()'.
    if(g_timeStep > 30) {   // did we wait >0.2 seconds?
      g_timeStep = 30;
    }
    // Update min/max for timeStep:
    if     (g_timeStep < g_timeStepMin) g_timeStepMin = g_timeStep;
    else if(g_timeStep > g_timeStepMax) g_timeStepMax = g_timeStep;

    if(isClear == 1) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    viewMatrix.setLookAt(g_EyeX, g_EyeY, g_EyeZ, // eye position
                        g_LookX, g_LookY, g_LookZ, 	// look-at point
                        0, 1, 0);									// up vector
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);

    modelMatrix.setTranslate(0.0, 0, 0.0);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  	draw(g_gndPlane);
    modelMatrix.setTranslate(0.0, 0, 0.0);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  	draw(g_partA);
    modelMatrix.setTranslate(-0.5, 0, -0.5);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    draw(g_partB);
    modelMatrix.setTranslate(0.0, 0, -1.5);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    draw(g_partC);
    modelMatrix.setTranslate(0.5, 0, -0.5);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    draw(g_partD);

    printControls();				// Display particle-system status on-screen.

    requestAnimationFrame(tick, g_canvas);
  };
  tick();
}

function animate() {
//==============================================================================
// Returns how much time (in milliseconds) passed since the last call to this fcn.
  var now = Date.now();
  var elapsed = now - g_last;	// amount of time passed, in integer milliseconds
  g_last = now;               // re-set our stopwatch/timer.

  g_stepCount = (g_stepCount +1)%1000;		// count 0,1,2,...999,0,1,2,...

  return elapsed;
}

function draw(sys) {

  // update particle system state?
  if(sys.runMode > 1) {								// 0=reset; 1= pause; 2=step; 3=run
		if(sys.runMode == 2) sys.runMode=1;			// (if 2, do just one step and pause.)
    sys.solver();
	}
  gl.uniform1i(u_sysType, sys.sysType);
  sys.render();     // transfer current state to VBO, set uniforms, draw it!
}

//===================Mouse and Keyboard event-handling Callbacks================
function myMouseDown(ev) {
  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									  // x==0 at canvas left edge
  var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge

	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);

	isDrag = true;											// set our mouse-dragging flag
	xMclik = x;													// record where mouse-dragging began
	yMclik = y;
		document.getElementById('MouseResult1').innerHTML =
	'myMouseDown() at CVV coords x,y = '+x+', '+y+'<br>';
};


function myMouseMove(ev) {

	if(isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									  // x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge

	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);

	// find how far we dragged the mouse:
	xMdragTot += (x - xMclik);					// Accumulate change-in-mouse-position,&
	yMdragTot += (y - yMclik);
	xMclik = x;													// Make next drag-measurement from here.
	yMclik = y;
  // (? why no 'document.getElementById() call here, as we did for myMouseDown()
  // and myMouseUp()? Because the webpage doesn't get updated when we move the
  // mouse. Put the web-page updating command in the 'draw()' function instead)
};

function myMouseUp(ev) {
  // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									  // x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
  //  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);

	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);
	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);

	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);
	// Put it on our webpage too...
	document.getElementById('MouseResult1').innerHTML =
	'myMouseUp(       ) at CVV coords x,y = '+x+', '+y+'<br>';
};


function myKeyPress(ev) {
	myChar = String.fromCharCode(ev.keyCode);	//	convert code to character-string

  vel = 0.1;
  vel = Math.min(5, vel);
  var dx = vel*(g_LookX - g_EyeX);
  var dy = vel*(g_LookY - g_EyeY);
  var dz = vel*(g_LookZ - g_EyeZ);
  var crossprod = cross([dx, dy, dz], [0, 1, 0]);

  if(ev.keyCode == 39) { // The right arrow key was pressed
      g_EyeX += crossprod[0];
      g_EyeY += crossprod[1];
      g_EyeZ += crossprod[2];
      g_LookX += crossprod[0];
      g_LookY += crossprod[1];
      g_LookZ += crossprod[2];
  } else if(ev.keyCode == 38) { // The up arrow key was pressed
      g_EyeX += dx;
      g_EyeY += dy;
      g_EyeZ += dz;
      g_LookX += dx;
      g_LookY += dy;
      g_LookZ += dz;
  } else if(ev.keyCode == 40) { // The down arrow key was pressed
      g_EyeX -= dx;
      g_EyeY -= dy;
      g_EyeZ -= dz;
      g_LookX -= dx;
      g_LookY -= dy;
      g_LookZ -= dz;
  } else if (ev.keyCode == 37) { // The left arrow key was pressed
      g_EyeX -= crossprod[0];
      g_EyeY -= crossprod[1];
      g_EyeZ -= crossprod[2];
      g_LookX -= crossprod[0];
      g_LookY -= crossprod[1];
      g_LookZ -= crossprod[2];
  }

	switch(myChar) {
    case 'W':
      currentAngle[1] -= 0.03;
      g_LookY = g_EyeY + Math.cos(currentAngle[1]);
      break;
    case 'A':
      currentAngle[0] -= 0.02;
      g_LookX = g_EyeX + Math.cos(currentAngle[0]);
      g_LookZ = g_EyeZ + Math.sin(currentAngle[0]);
      break;
    case 'S':
      currentAngle[1] += 0.03;
      g_LookY = g_EyeY + Math.cos(currentAngle[1]);
      break;
    case 'D':
      currentAngle[0] += 0.02;
      g_LookX = g_EyeX + Math.cos(currentAngle[0]);
      g_LookZ = g_EyeZ + Math.sin(currentAngle[0]);
      break;
		case '0':
			g_partA.runMode = 0;			// RESET!
      g_partB.runMode = 0;			// RESET!
      g_partC.runMode = 0;			// RESET!
      g_partD.runMode = 0;			// RESET!
      g_timeStepMin = g_timeStep;
      g_timeStepMax = g_timeStep;
			break;
    case 'P':
		case '1':
			g_partA.runMode = 1;			// PAUSE!
      g_partB.runMode = 1;			// PAUSE!
      g_partC.runMode = 1;			// PAUSE!
      g_partD.runMode = 1;			// PAUSE!
			break;
  	case ' ':			// space-bar: single-step
		case '2':
			g_partA.runMode = 2;			// STEP!
			g_partB.runMode = 2;			// STEP!
			g_partC.runMode = 2;			// STEP!
      g_partD.runMode = 2;			// STEP!
			break;
    case 'R':
    case '3':							      // RUN!
      g_partA.runMode = 3;
      g_partB.runMode = 3;
      g_partC.runMode = 3;
      g_partD.runMode = 3;
			break;
		case 'T':  // HARD reset: position AND velocity.
      g_partA.runMode = 0;			// RESET!
      g_partC.init(SYS_SPRING_CLOTH, g_partA.xSize, g_partA.ySize);
      g_partB.runMode = 0;			// RESET!
      g_partB.init(SYS_TORNADO, g_partB.partCount);
      g_partC.runMode = 0;			// RESET!
      g_partA.init(SYS_FLOCKING, g_partC.partCount);
      g_partD.runMode = 0;			// RESET!
      g_partD.init(SYS_FIRE_REEVES, g_partD.partCount);
			break;
		case 'Q':
			// switch to a different solver:
      let solver = g_partA.solvType;
			if (solver == SOLV_EULER) solver = SOLV_MIDPOINT;
			else if (solver == SOLV_MIDPOINT) solver = SOLV_SYMPLECTIC;
      else if (solver == SOLV_SYMPLECTIC) solver = SOLV_VERLET;
      else if (solver == SOLV_VERLET) solver = SOLV_BACK_EULER;
      else if (solver == SOLV_BACK_EULER) solver = SOLV_EULER;
      g_partA.solvType = solver;
      g_partB.solvType = solver;
      g_partC.solvType = solver;
      g_partD.solvType = solver;
			break;
		default:
			break;
	}
}

function cross([x1,x2,x3],[y1,y2,y3]) {
  return [x2*y3-x3*y2, x3*y1-y3*x1, x1*y2-y1*x2];
}

function printControls() {
//==============================================================================
// Print current state of the particle system on the webpage:
	var recipTime = 1000.0 / g_timeStep;			// to report fractional seconds
	var recipMin  = 1000.0 / g_timeStepMin;
	var recipMax  = 1000.0 / g_timeStepMax;
	var solvTypeTxt;												// convert solver number to text:
	if(g_partA.solvType==0)       solvTypeTxt = 'SOLV_EULER';
	else if	(g_partA.solvType==1) solvTypeTxt = 'SOLV_MIDPOINT';
  else if	(g_partA.solvType==4) solvTypeTxt = 'SOLV_BACK_EULER';
  else if	(g_partA.solvType==6) solvTypeTxt = 'SOLV_VERLET';
  else if	(g_partA.solvType==9) solvTypeTxt = 'SOLV_SYMPLECTIC';
  else                          solvTypeTxt = 'unknown';

	document.getElementById('KeyResult').innerHTML =
   			'<b>Solver = </b>' + solvTypeTxt +
   			'<br><b>timeStep = </b> 1/' + recipTime.toFixed(3) + ' sec' +
   			                ' <b>min:</b> 1/' + recipMin.toFixed(3)  + ' sec' +
   			                ' <b>max:</b> 1/' + recipMax.toFixed(3)  + ' sec<br>' +
   			' <b>stepCount: </b>' + g_stepCount.toFixed(3) +
        ' <br><b>Lookat: </b>' + g_LookX + ', ' + g_LookY + ', ' + g_LookZ +
        ' <br><b>EyePos: </b>' + g_EyeX + ', ' + g_EyeY + ', ' + g_EyeZ;

  document.getElementById('MouseResult0').innerHTML=
      '<b>Mouse Drag totals (CVV coords)</b>:\t'+xMdragTot+', \t'+yMdragTot;
}
