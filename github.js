require("dotenv").config();

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const org = "abacum-io";
const gifRegexp = /\!\[\]\((.*gif)\)/gm;

const getRepos = async () => octokit.repos.listForOrg({ org });

const getPRsPage = async (repo, page) => {
  return octokit.pulls.list({
    owner: org,
    repo,
    state: "all",
    sort: "created",
    per_page: 50,
    page,
  });
};

const getPRs = async (repo, page = 0, prs = []) => {
  const { data } = await getPRsPage(repo, page);

  if (data.length === 0) {
    return prs;
  }
  return await getPRs(repo, page + 1, prs.concat(data));
};

const extractGif = (body) => {
  const match = gifRegexp.exec(body);
  return !!match ? match[1] : null;
};

const infoFromPr = ({ user, body, html_url, title, created_at }) => {
  const gif = extractGif(body);
  return {
    gif,
    user: user.login,
    avatar: user.avatar_url,
    html_url,
    created_at,
    title,
  };
};

const withGifAndGivenMonth = (lastMonth, { gif, created_at }) => {
  const month = new Date(Date.parse(created_at)).getMonth();
  return gif && month === lastMonth;
};

const gifsFromRepo = async (repo) => {
  const lastMonth = new Date().getMonth();
  const prs = await getPRs(repo.name);
  const mappedPrs = prs.map(infoFromPr);
  const gifs = mappedPrs.filter((pr) => withGifAndGivenMonth(lastMonth, pr));

  return gifs; // cleanup nulls
};

const gifsFromRepos = async (repos) =>
  Promise.all(repos.map(async (repo) => await gifsFromRepo(repo)));

const getGifs = async () => {
  const { data } = await getRepos();
  const gifsList = await gifsFromRepos(data);
  return gifsList.flat();
};

getGifs()
  .then((gifs) => console.log("finished", gifs))
  .catch(console.log);