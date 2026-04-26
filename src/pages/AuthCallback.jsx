const AuthCallback = () => {
  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 640, margin: '40px auto' }}>
        <h1 className="heading-large">Auth Callback</h1>
        <p className="text-muted">This app uses a personal access token stored locally. Please return to the home screen and enter your token, repo owner, and repo name.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
